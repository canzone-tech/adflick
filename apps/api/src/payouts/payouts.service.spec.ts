import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PayoutBatchStatus, UserRole } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PayoutsService concurrent approval guard', () => {
  const actor: AuthenticatedUser = {
    sub: 'approver-a', email: 'approver@example.test', organizationId: 'org-a',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-a',
  };
  const batch = {
    id: 'batch-a', organizationId: 'org-a', batchReference: 'BATCH-A',
    status: PayoutBatchStatus.PENDING_APPROVAL, createdById: 'maker-b',
    totalAmountPaise: 50000, itemCount: 1,
  };
  const tx = {
    payoutBatch: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    payoutBatch: { findFirst: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(tx)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payoutBatch.findFirst.mockResolvedValue(batch);
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 0 });
  });

  it('rejects a stale concurrent decision when the conditional update affects no row', async () => {
    const service = new PayoutsService(prisma as any);
    await expect(service.decide(actor, batch.id, { status: 'APPROVED', note: 'reviewed' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.payoutBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: batch.id, organizationId: actor.organizationId, status: PayoutBatchStatus.PENDING_APPROVAL },
    }));
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('prevents the batch creator from approving their own batch', async () => {
    prisma.payoutBatch.findFirst.mockResolvedValue({ ...batch, createdById: actor.sub });
    const service = new PayoutsService(prisma as any);
    await expect(service.decide(actor, batch.id, { status: 'APPROVED' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes the approval audit only after a successful conditional transition', async () => {
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutBatch.findUniqueOrThrow.mockResolvedValue({ ...batch, status: PayoutBatchStatus.APPROVED });
    const service = new PayoutsService(prisma as any);
    await service.decide(actor, batch.id, { status: 'APPROVED', note: 'reviewed' });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYOUT_BATCH_APPROVED', organizationId: actor.organizationId }),
    }));
  });
});
