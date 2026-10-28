import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  FinanceApprovalStatus, LedgerEntryType, RewardCalculationStatus, UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FinanceService } from './finance.service';

describe('FinanceService approval accounting boundary', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-checker', email: 'checker@example.test', organizationId: 'org-a',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'checker-session',
  };
  const approvedPeriod = {
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-01T00:00:00.000Z'),
  };
  const approval = () => ({
    id: 'approval-a', organizationId: 'org-a', requestedById: 'different-maker',
    rewardCalculationId: 'calc-a', status: FinanceApprovalStatus.PENDING,
    calculation: {
      id: 'calc-a', status: RewardCalculationStatus.PENDING_APPROVAL,
      amountPaise: 250, ...approvedPeriod,
    },
  });
  const tx = {
    financeApproval: { update: jest.fn() },
    rewardCalculation: { update: jest.fn() },
    rewardLedgerEntry: { create: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    financeApproval: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new FinanceService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.financeApproval.findFirst.mockResolvedValue(approval());
    tx.financeApproval.update.mockResolvedValue({ id: 'approval-a', status: FinanceApprovalStatus.APPROVED });
    tx.rewardCalculation.update.mockResolvedValue({ id: 'calc-a' });
    tx.rewardLedgerEntry.create.mockResolvedValue({ id: 'ledger-a' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-a' });
    prisma.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx));
  });

  it('denies non-finance roles before reading approvals or opening a transaction', async () => {
    await expect(service.decide({ ...actor, roles: [UserRole.ADVERTISER] }, 'approval-a', {
      status: 'APPROVED',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.financeApproval.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not act on an approval from another organization', async () => {
    prisma.financeApproval.findFirst.mockResolvedValue(null);
    await expect(service.decide(actor, 'foreign-approval', { status: 'APPROVED' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.financeApproval.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-approval', organizationId: actor.organizationId },
      include: { calculation: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects previously decided records without writing another ledger entry', async () => {
    prisma.financeApproval.findFirst.mockResolvedValue({
      ...approval(), status: FinanceApprovalStatus.APPROVED,
    });
    await expect(service.decide(actor, 'approval-a', { status: 'APPROVED' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('writes exactly one scoped candidate accrual and an audit within the approval transaction', async () => {
    await expect(service.decide(actor, 'approval-a', { status: 'APPROVED', note: 'Reviewed' }))
      .resolves.toMatchObject({ id: 'approval-a', status: FinanceApprovalStatus.APPROVED });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.financeApproval.update).toHaveBeenCalledWith({
      where: { id: 'approval-a', organizationId: 'org-a' },
      data: expect.objectContaining({ decidedById: actor.sub, status: FinanceApprovalStatus.APPROVED }),
    });
    expect(tx.rewardCalculation.update).toHaveBeenCalledWith({
      where: { id: 'calc-a', organizationId: 'org-a' },
      data: expect.objectContaining({ status: RewardCalculationStatus.APPROVED }),
    });
    expect(tx.rewardLedgerEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.rewardLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-a', rewardCalculationId: 'calc-a',
        entryType: LedgerEntryType.REWARD_ACCRUAL,
        amountPaise: approval().calculation.amountPaise,
        idempotencyKey: 'reward-accrual:calc-a', createdById: actor.sub,
      }),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REWARD_APPROVAL_APPROVED', organizationId: 'org-a', actorUserId: actor.sub,
      }),
    });
    expect(tx.rewardLedgerEntry.create.mock.invocationCallOrder[0])
      .toBeLessThan(tx.auditEvent.create.mock.invocationCallOrder[0]);
  });

  it('does not accrue or mark approved when finance rejects a pending request', async () => {
    await service.decide(actor, 'approval-a', { status: 'REJECTED', note: 'Evidence incomplete' });
    expect(tx.financeApproval.update).toHaveBeenCalledWith({
      where: { id: 'approval-a', organizationId: 'org-a' },
      data: expect.objectContaining({ status: FinanceApprovalStatus.REJECTED }),
    });
    expect(tx.rewardCalculation.update).toHaveBeenCalledWith({
      where: { id: 'calc-a', organizationId: 'org-a' },
      data: expect.objectContaining({ status: RewardCalculationStatus.REJECTED }),
    });
    expect(tx.rewardLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('does not return success when the transaction audit write rejects', async () => {
    tx.auditEvent.create.mockRejectedValue(new Error('audit-persistence-failed'));
    await expect(service.decide(actor, 'approval-a', { status: 'APPROVED' }))
      .rejects.toThrow('audit-persistence-failed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.rewardLedgerEntry.create).toHaveBeenCalledTimes(1);
    // Mock only verifies propagation. Actual MySQL rollback remains covered by integration tests.
  });
});
