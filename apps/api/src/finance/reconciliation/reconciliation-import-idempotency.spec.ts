import { reserveReconciliationImport, ReconciliationImportStore } from './reconciliation-import-idempotency';

describe('reserveReconciliationImport', () => {
  const base = { organizationId: 'org-1', providerName: 'SANDBOX', idempotencyKey: 'statement-2026-10-14', rawPayload: 'provider,payout,amount\\nP1,PAY1,100' };
  const uniqueError = { code: 'P2002' };

  it('creates a durable reservation for a first submission', async () => {
    const store: ReconciliationImportStore = {
      create: jest.fn().mockResolvedValue({ id: 'imp-1', status: 'RECEIVED' }),
      findByKey: jest.fn(),
    };
    await expect(reserveReconciliationImport(store, base)).resolves.toEqual({ outcome: 'CREATED', importId: 'imp-1' });
  });

  it('treats same-key same-payload completed submission as a replay, not a new import', async () => {
    const store: ReconciliationImportStore = {
      create: jest.fn().mockRejectedValue(uniqueError),
      findByKey: jest.fn().mockResolvedValue({ id: 'imp-1', payloadSha256: 'f'.repeat(64), status: 'COMPLETED' }),
    };
    // Make the stored digest match the actual payload digest through a first reservation.
    const firstStore: ReconciliationImportStore = {
      create: jest.fn().mockResolvedValue({ id: 'imp-1', status: 'RECEIVED' }),
      findByKey: jest.fn(),
    };
    const created = await reserveReconciliationImport(firstStore, base);
    const crypto = await import('node:crypto');
    store.findByKey = jest.fn().mockResolvedValue({ id: 'imp-1', payloadSha256: crypto.createHash('sha256').update(base.rawPayload).digest('hex'), status: 'COMPLETED' });
    await expect(reserveReconciliationImport(store, base)).resolves.toEqual({ outcome: 'REPLAY', importId: 'imp-1', status: 'COMPLETED' });
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(created.outcome).toBe('CREATED');
  });

  it('rejects same idempotency key when payload differs', async () => {
    const crypto = await import('node:crypto');
    const digest = crypto.createHash('sha256').update(base.rawPayload).digest('hex');
    const store: ReconciliationImportStore = {
      create: jest.fn().mockRejectedValue(uniqueError),
      findByKey: jest.fn().mockResolvedValue({ id: 'imp-1', payloadSha256: digest, status: 'COMPLETED' }),
    };
    await expect(reserveReconciliationImport(store, { ...base, rawPayload: 'different payload' })).resolves.toMatchObject({ outcome: 'PAYLOAD_CONFLICT', importId: 'imp-1' });
  });

  it('does not reprocess an import already in progress', async () => {
    const crypto = await import('node:crypto');
    const digest = crypto.createHash('sha256').update(base.rawPayload).digest('hex');
    const store: ReconciliationImportStore = {
      create: jest.fn().mockRejectedValue(uniqueError),
      findByKey: jest.fn().mockResolvedValue({ id: 'imp-1', payloadSha256: digest, status: 'PROCESSING', processingLeaseUntil: new Date(Date.now() + 60_000) }),
    };
    await expect(reserveReconciliationImport(store, base)).resolves.toEqual({ outcome: 'IN_PROGRESS', importId: 'imp-1' });
  });

  it('allows only an expired processing lease to be recovered', async () => {
    const crypto = await import('node:crypto');
    const digest = crypto.createHash('sha256').update(base.rawPayload).digest('hex');
    const store: ReconciliationImportStore = {
      create: jest.fn().mockRejectedValue(uniqueError),
      findByKey: jest.fn().mockResolvedValue({
        id: 'imp-1', payloadSha256: digest, status: 'PROCESSING', processingLeaseUntil: new Date(Date.now() - 60_000),
      }),
    };
    await expect(reserveReconciliationImport(store, base)).resolves.toEqual({ outcome: 'RECOVERABLE', importId: 'imp-1' });
  });

  it('fails closed if unique conflict cannot be resolved inside tenant scope', async () => {
    const store: ReconciliationImportStore = {
      create: jest.fn().mockRejectedValue(uniqueError),
      findByKey: jest.fn().mockResolvedValue(null),
    };
    await expect(reserveReconciliationImport(store, base)).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT_RECORD_NOT_FOUND');
  });
});
