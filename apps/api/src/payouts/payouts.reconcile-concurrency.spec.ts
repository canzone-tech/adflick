import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { PayoutBatchStatus, PayoutItemStatus, UserRole } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PayoutsService reconciliation concurrency guard', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-a', email: 'finance@example.test', organizationId: 'org-a',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-a',
  };
  const batch = {
    id: 'batch-a', organizationId: 'org-a', status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER,
    items: [{ id: 'item-a', ledgerEntryId: 'ledger-a', status: PayoutItemStatus.SUBMITTED }],
  };
  const tx = {
    payoutItem: { updateMany: jest.fn(), findMany: jest.fn() },
    payoutBatch: { update: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    payoutBatch: { findFirst: jest.fn() },
    financeDispute: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payoutBatch.findFirst.mockResolvedValue(batch);
    prisma.financeDispute.findMany.mockResolvedValue([]);
    tx.payoutItem.updateMany.mockResolvedValue({ count: 0 });
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutBatch.findUniqueOrThrow.mockResolvedValue({ id: 'batch-a', status: PayoutBatchStatus.PARTIALLY_RECONCILED });
  });

  it('rejects a stale reconciliation write if another transaction made the item terminal', async () => {
    const service = new PayoutsService(prisma as unknown as PrismaService);
    await expect(service.reconcile(actor, batch.id, {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as Parameters<PayoutsService['reconcile']>[2])).rejects.toBeInstanceOf(ConflictException);

    expect(tx.payoutItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'item-a', payoutBatchId: 'batch-a', organizationId: 'org-a',
        status: { notIn: [PayoutItemStatus.PAID, PayoutItemStatus.REVERSED] },
      }),
    }));
    expect(tx.payoutItem.findMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('scopes the final batch item read to the organization', async () => {
    tx.payoutItem.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutItem.findMany.mockResolvedValue([{ status: PayoutItemStatus.FAILED }]);
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 1 });
    const service = new PayoutsService(prisma as unknown as PrismaService);
    await service.reconcile(actor, batch.id, {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as Parameters<PayoutsService['reconcile']>[2]);
    expect(tx.payoutItem.findMany).toHaveBeenCalledWith({ where: { payoutBatchId: 'batch-a', organizationId: 'org-a' } });
  });
  it('rejects a stale batch transition and does not write a success audit', async () => {
    tx.payoutItem.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutItem.findMany.mockResolvedValue([{ status: PayoutItemStatus.FAILED }]);
    tx.payoutBatch.updateMany.mockResolvedValue({ count: 0 });
    const service = new PayoutsService(prisma as unknown as PrismaService);
    await expect(service.reconcile(actor, batch.id, {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as Parameters<PayoutsService['reconcile']>[2])).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payoutBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'batch-a', organizationId: 'org-a',
        status: { in: [PayoutBatchStatus.SUBMITTED_TO_PROVIDER, PayoutBatchStatus.RECONCILIATION_REQUIRED, PayoutBatchStatus.PARTIALLY_RECONCILED] },
      }),
    }));
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('writes the reconciliation audit only after the conditional batch transition succeeds', async () => {
    tx.payoutItem.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutItem.findMany.mockResolvedValue([{ status: PayoutItemStatus.FAILED }]);
    const service = new PayoutsService(prisma as unknown as PrismaService);
    await service.reconcile(actor, batch.id, {
      items: [{ payoutItemId: 'item-a', status: 'FAILED', note: 'Provider reported failure' }],
    } as Parameters<PayoutsService['reconcile']>[2]);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYOUT_BATCH_RECONCILED', organizationId: 'org-a' }),
    }));
  });

});
