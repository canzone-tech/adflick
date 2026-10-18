import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { RewardCalculationStatus, FinanceApprovalStatus } from '@prisma/client';

describe('FinanceService maker-checker controls', () => {
  const actor = { sub: 'maker-1', email: 'maker@example.test', organizationId: 'org-1', roles: ['FINANCE_MANAGER'], sessionId: 'session-1' };
  let prisma: any; let service: FinanceService;
  beforeEach(() => {
    prisma = { rewardCalculation: { findFirst: jest.fn(), update: jest.fn() }, financeApproval: { findFirst: jest.fn(), create: jest.fn() }, auditEvent: { create: jest.fn() }, $transaction: jest.fn() };
    service = new FinanceService(prisma);
  });
  it('refuses approval requests for ineligible calculations', async () => {
    prisma.rewardCalculation.findFirst.mockResolvedValue({ id: 'reward-1', organizationId: 'org-1', status: RewardCalculationStatus.INELIGIBLE, amountPaise: 0 });
    await expect(service.requestApproval(actor, 'reward-1')).rejects.toBeInstanceOf(ConflictException);
  });
  it('refuses self-approval even for a pending approval', async () => {
    prisma.financeApproval.findFirst.mockResolvedValue({ id: 'approval-1', organizationId: 'org-1', requestedById: actor.sub, status: FinanceApprovalStatus.PENDING, calculation: { id: 'reward-1', status: RewardCalculationStatus.PENDING_APPROVAL, amountPaise: 100000 } });
    await expect(service.decide(actor, 'approval-1', { status: 'APPROVED', note: 'test' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not create an approval for a missing reward calculation', async () => {
    prisma.rewardCalculation.findFirst.mockResolvedValue(null);
    await expect(service.requestApproval(actor, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
