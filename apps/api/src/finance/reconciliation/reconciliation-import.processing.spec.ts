import { PrismaReconciliationImportStore } from './prisma-reconciliation-import-store';
import { createHash } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { ReconciliationImportService } from './reconciliation-import.service';

describe('ReconciliationImportService.process', () => {
  const tx = {
    reconciliationImportRow: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    reconciliationImport: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    payoutItem: {
      findMany: jest.fn().mockResolvedValue([{
        id: 'item-1', providerReference: 'provider-tx-1', amountPaise: 25000, currency: 'INR', status: 'SUBMITTED',
      }]),
    },
    $transaction: jest.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx)),
    reconciliationImport: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const store = {
    prisma,
    create: jest.fn().mockResolvedValue({ id: 'import-1', status: 'RECEIVED' }),
    findByKey: jest.fn(),
  };
  const service = new ReconciliationImportService(store as unknown as PrismaReconciliationImportStore);
  const actor = {
    sub: 'finance-1', email: 'finance@example.test', organizationId: 'org-1',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-1',
  };
  const dto = {
    providerName: 'SANDBOX', idempotencyKey: 'statement-1',
    payload: 'providerReference,payoutReference,amountPaise,currency,status\nprovider-tx-1,item-1,25000,INR,PAID',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store.create.mockResolvedValue({ id: 'import-1', status: 'RECEIVED' });
    prisma.payoutItem.findMany.mockResolvedValue([{
      id: 'item-1', providerReference: 'provider-tx-1', amountPaise: 25000, currency: 'INR', status: 'SUBMITTED',
    }]);
    tx.reconciliationImportRow.createMany.mockResolvedValue({ count: 1 });
    tx.reconciliationImport.updateMany.mockResolvedValue({ count: 1 });
  });

  it('persists match results and import completion in one transaction without changing payout state', async () => {
    await expect(service.process(actor, dto)).resolves.toMatchObject({
      outcome: 'PROCESSED', importId: 'import-1', rowCount: 1, matchedCount: 1, discrepancyCount: 0,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.reconciliationImportRow.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ organizationId: 'org-1', importId: 'import-1', payoutReference: 'item-1', outcome: 'MATCH' })],
    });
    expect(tx.reconciliationImport.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'import-1', organizationId: 'org-1', status: 'PROCESSING', processingToken: expect.any(String) },
      data: expect.objectContaining({ status: 'COMPLETED', rowCount: 1 }),
    }));
    expect(prisma.payoutItem).not.toHaveProperty('update');
  });

  it('rejects completion if the worker loses its claim before commit', async () => {
    tx.reconciliationImport.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.process(actor, dto)).rejects.toThrow('RECONCILIATION_IMPORT_CLAIM_LOST');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.reconciliationImportRow.createMany).toHaveBeenCalledTimes(1);
  });

  it('does not process a duplicate reservation a second time', async () => {
    store.create.mockRejectedValue({ code: 'P2002' });
    store.findByKey.mockResolvedValue({
      id: 'import-1',
      payloadSha256: createHash('sha256').update(dto.payload).digest('hex'),
      status: 'COMPLETED',
    });
    await expect(service.process(actor, dto)).resolves.toMatchObject({ outcome: 'REPLAY', importId: 'import-1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
