import { PayoutBatchStatus, PayoutItemStatus, UserRole } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PayoutsService reconciliation transaction integrity', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-a', email: 'finance@example.test', organizationId: 'org-a',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-a',
  };
  const batch = {
    id: 'batch-a', organizationId: 'org-a', status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER,
    items: [{ id: 'item-a', organizationId: 'org-a', ledgerEntryId: 'ledger-a', status: PayoutItemStatus.SUBMITTED }],
  };
  const tx = {
    payoutItem: { updateMany: jest.fn(), findMany: jest.fn() },
    payoutBatch: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    payoutBatch: { findFirst: jest.fn() },
    financeDispute: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(tx)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payoutBatch.findFirst.mockResolvedValue(batch);
    prisma.financeDispute.findMany.mockResolvedValue([]);
    tx.payoutItem.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutItem.findMany.mockResolvedValue([{ status: PayoutItemStatus.FAILED }]);
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutBatch.findUniqueOrThrow.mockResolvedValue({ id: 'batch-a', organizationId: 'org-a' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-a' });
  });

  it('loads reconciliation items with the authenticated organization predicate', async () => {
    const service = new PayoutsService(prisma as any);
    await service.reconcile(actor, 'batch-a', {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as any);
    expect(prisma.payoutBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 'batch-a', organizationId: 'org-a' },
      include: { items: { where: { organizationId: 'org-a' } } },
    });
  });

  it('propagates audit persistence failure instead of returning reconciliation success', async () => {
    tx.auditEvent.create.mockRejectedValue(new Error('simulated audit insert failure'));
    const service = new PayoutsService(prisma as any);
    await expect(service.reconcile(actor, 'batch-a', {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as any)).rejects.toThrow('simulated audit insert failure');

    expect(tx.payoutItem.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.payoutBatch.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.payoutBatch.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
