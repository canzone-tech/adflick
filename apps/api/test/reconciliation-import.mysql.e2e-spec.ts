import 'reflect-metadata';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_MYSQL_FINANCE_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('MySQL 8.4 reconciliation import concurrency and persistence', () => {
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  const importIds: string[] = [];
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  async function makeImport(orgId = organizationId, status: 'RECEIVED' | 'PROCESSING' = 'RECEIVED', lease?: Date) {
    const item = await prisma.reconciliationImport.create({
      data: {
        organizationId: orgId,
        providerName: 'BATCH43_SANDBOX',
        idempotencyKey: `b43-${suffix}-${importIds.length}-${Math.random().toString(36).slice(2, 6)}`,
        payloadSha256: 'a'.repeat(64),
        status,
        processingToken: status === 'PROCESSING' ? `old-${Math.random().toString(36).slice(2, 12)}` : null,
        processingLeaseUntil: lease ?? null,
      },
      select: { id: true },
    });
    importIds.push(item.id);
    return item.id;
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.startsWith('mysql://')) throw new Error('Requires MySQL; PostgreSQL is not supported.');
    if (!process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost')) {
      throw new Error('Refusing non-local database. Use a disposable MySQL 8.4 test database.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const orgA = await prisma.organization.create({ data: { name: `Batch 43 A ${suffix}`, slug: `b43-a-${suffix}` }, select: { id: true } });
    organizationId = orgA.id;
    const orgB = await prisma.organization.create({ data: { name: `Batch 43 B ${suffix}`, slug: `b43-b-${suffix}` }, select: { id: true } });
    otherOrganizationId = orgB.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (importIds.length) await prisma.reconciliationImportRow.deleteMany({ where: { importId: { in: importIds } } });
      if (importIds.length) await prisma.reconciliationImport.deleteMany({ where: { id: { in: importIds } } });
      if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
      if (otherOrganizationId) await prisma.organization.deleteMany({ where: { id: otherOrganizationId } });
      await prisma.$disconnect();
    }
  }, 30_000);

  it('allows exactly one concurrent worker to claim a RECEIVED import', async () => {
    const id = await makeImport();
    const claim = (token: string) => prisma.reconciliationImport.updateMany({
      where: { id, organizationId, status: 'RECEIVED' },
      data: { status: 'PROCESSING', processingToken: token, processingLeaseUntil: new Date(Date.now() + 60_000), attemptCount: { increment: 1 } },
    });
    const results = await Promise.all([claim(`worker-a-${suffix}`), claim(`worker-b-${suffix}`)]);
    expect(results.reduce((sum, result) => sum + result.count, 0)).toBe(1);
    const saved = await prisma.reconciliationImport.findFirstOrThrow({ where: { id, organizationId } });
    expect(saved.status).toBe('PROCESSING');
    expect(saved.attemptCount).toBe(1);
    expect(saved.processingToken).toMatch(/^worker-[ab]-/);
  });

  it('allows one worker to recover an expired lease and rejects stale workers at commit', async () => {
    const id = await makeImport(organizationId, 'PROCESSING', new Date(Date.now() - 60_000));
    const claim = (token: string) => prisma.reconciliationImport.updateMany({
      where: { id, organizationId, status: 'PROCESSING', processingLeaseUntil: { lte: new Date() } },
      data: { processingToken: token, processingLeaseUntil: new Date(Date.now() + 60_000), attemptCount: { increment: 1 } },
    });
    const results = await Promise.all([claim(`recovery-a-${suffix}`), claim(`recovery-b-${suffix}`)]);
    expect(results.reduce((sum, result) => sum + result.count, 0)).toBe(1);
    const saved = await prisma.reconciliationImport.findFirstOrThrow({ where: { id, organizationId } });
    const winner = saved.processingToken!;
    const stale = winner.startsWith('recovery-a-') ? `recovery-b-${suffix}` : `recovery-a-${suffix}`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.reconciliationImportRow.create({ data: {
        organizationId, importId: id, rowNumber: 2, providerReference: 'provider-1', payoutReference: 'payout-1',
        amountPaise: 10000, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'MATCH', detail: null,
      } });
      const completed = await tx.reconciliationImport.updateMany({
        where: { id, organizationId, status: 'PROCESSING', processingToken: stale },
        data: { status: 'COMPLETED', processingToken: null, processingLeaseUntil: null },
      });
      if (completed.count !== 1) throw new Error('BATCH43_STALE_CLAIM');
    })).rejects.toThrow('BATCH43_STALE_CLAIM');
    expect(await prisma.reconciliationImportRow.count({ where: { importId: id } })).toBe(0);
    expect((await prisma.reconciliationImport.findFirstOrThrow({ where: { id } })).processingToken).toBe(winner);
  });

  it('rolls back persisted discrepancy rows and counters if completion fails', async () => {
    const id = await makeImport(organizationId, 'PROCESSING', new Date(Date.now() + 60_000));
    const current = await prisma.reconciliationImport.findFirstOrThrow({ where: { id } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.reconciliationImportRow.createMany({ data: [
        { organizationId, importId: id, rowNumber: 2, providerReference: 'provider-bad', payoutReference: 'payout-bad', amountPaise: 9000, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'AMOUNT_MISMATCH', detail: 'Statement amount differs' },
      ] });
      const result = await tx.reconciliationImport.updateMany({
        where: { id, organizationId, status: 'PROCESSING', processingToken: 'not-the-current-token' },
        data: { status: 'COMPLETED', rowCount: 1, discrepancyCount: 1, processingToken: null, processingLeaseUntil: null },
      });
      if (result.count !== 1) throw new Error('BATCH43_COMPLETION_CAS_FAILED');
    })).rejects.toThrow('BATCH43_COMPLETION_CAS_FAILED');
    const saved = await prisma.reconciliationImport.findFirstOrThrow({ where: { id } });
    expect(await prisma.reconciliationImportRow.count({ where: { importId: id } })).toBe(0);
    expect(saved.status).toBe('PROCESSING');
    expect(saved.rowCount).toBe(0);
    expect(saved.discrepancyCount).toBe(0);
    expect(current.processingToken).toBeTruthy();
  });

  it('enforces tenant scope on claim, row reads and import completion', async () => {
    const id = await makeImport();
    const foreignClaim = await prisma.reconciliationImport.updateMany({
      where: { id, organizationId: otherOrganizationId, status: 'RECEIVED' },
      data: { status: 'PROCESSING', processingToken: `foreign-${suffix}` },
    });
    expect(foreignClaim.count).toBe(0);
    expect(await prisma.reconciliationImportRow.findMany({ where: { organizationId: otherOrganizationId, importId: id } })).toHaveLength(0);
    const foreignComplete = await prisma.reconciliationImport.updateMany({
      where: { id, organizationId: otherOrganizationId, status: 'RECEIVED' },
      data: { status: 'COMPLETED' },
    });
    expect(foreignComplete.count).toBe(0);
    expect((await prisma.reconciliationImport.findFirstOrThrow({ where: { id, organizationId } })).status).toBe('RECEIVED');
  });

  it('persists matched and discrepancy outcomes without changing payout items or transferring funds', async () => {
    const id = await makeImport(organizationId, 'PROCESSING', new Date(Date.now() + 60_000));
    const current = await prisma.reconciliationImport.findFirstOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      await tx.reconciliationImportRow.createMany({ data: [
        { organizationId, importId: id, rowNumber: 2, providerReference: 'provider-match', payoutReference: 'payout-match', amountPaise: 10000, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'MATCH', detail: null },
        { organizationId, importId: id, rowNumber: 3, providerReference: 'provider-diff', payoutReference: 'payout-diff', amountPaise: 12000, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'AMOUNT_MISMATCH', detail: 'Amount differs' },
      ] });
      const done = await tx.reconciliationImport.updateMany({
        where: { id, organizationId, status: 'PROCESSING', processingToken: current.processingToken },
        data: { status: 'COMPLETED', rowCount: 2, matchedCount: 1, discrepancyCount: 1, processingToken: null, processingLeaseUntil: null, completedAt: new Date() },
      });
      expect(done.count).toBe(1);
    });
    const persisted = await prisma.reconciliationImport.findFirstOrThrow({ where: { id, organizationId }, include: { rows: true } });
    expect(persisted.status).toBe('COMPLETED');
    expect(persisted.rowCount).toBe(2);
    expect(persisted.matchedCount).toBe(1);
    expect(persisted.discrepancyCount).toBe(1);
    expect(persisted.rows.map(row => row.outcome).sort()).toEqual(['AMOUNT_MISMATCH', 'MATCH']);
  });
});
