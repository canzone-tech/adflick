import 'reflect-metadata';
import { PrismaService } from '../src/prisma/prisma.service';
import { PayoutBatchStatus, UserRole, UserStatus } from '@prisma/client';
import { PayoutsService } from '../src/payouts/payouts.service';
import type { AuthenticatedUser } from '../src/auth/decorators/current-user.decorator';

const enabled = process.env.RUN_MYSQL_FINANCE_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('MySQL finance transaction atomicity (disposable MySQL 8.4 database only)', () => {
  let prisma: PrismaService;
  let organizationId: string;
  let actorUserId: string;
  let batchId: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.startsWith('mysql://')) {
      throw new Error('Finance integration tests require DATABASE_URL=mysql://...; PostgreSQL is not supported.');
    }
    if (!process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost')) {
      throw new Error('Refusing to run finance integration fixtures against a non-local database. Use a disposable local MySQL 8.4 database.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const organization = await prisma.organization.create({
      data: { name: `Batch 36 Finance ${suffix}`, slug: `batch36-finance-${suffix}` },
      select: { id: true },
    });
    organizationId = organization.id;
    const actor = await prisma.user.create({
      data: { organizationId, email: `batch36-finance-${suffix}@example.test`, displayName: 'Batch 36 Finance Test', status: UserStatus.ACTIVE },
      select: { id: true },
    });
    actorUserId = actor.id;
    const batch = await prisma.payoutBatch.create({
      data: {
        organizationId, batchReference: `B36-${suffix}`.slice(0, 80), createdById: actorUserId,
        providerName: 'SANDBOX', status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER,
      },
      select: { id: true },
    });
    batchId = batch.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma && batchId) {
      await prisma.auditEvent.deleteMany({ where: { organizationId, entityId: batchId } });
      await prisma.payoutBatch.deleteMany({ where: { id: batchId, organizationId } });
    }
    if (prisma && actorUserId) await prisma.user.deleteMany({ where: { id: actorUserId } });
    if (prisma && organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
    if (prisma) await prisma.$disconnect();
  }, 30_000);

  it('rolls back a batch status update when the audit insert fails', async () => {
    await expect(prisma.$transaction(async (tx) => {
      const changed = await tx.payoutBatch.updateMany({
        where: { id: batchId, organizationId, status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER },
        data: { status: PayoutBatchStatus.RECONCILIATION_REQUIRED },
      });
      expect(changed.count).toBe(1);
      // Intentionally invalid FK forces MySQL to reject the audit insert after the status write.
      await tx.auditEvent.create({
        data: {
          actorUserId: `missing-user-${suffix}`, organizationId, action: 'BATCH_36_FORCED_AUDIT_FAILURE',
          entityType: 'PayoutBatch', entityId: batchId, metadataJson: { test: true },
        },
      });
    })).rejects.toThrow();

    const persisted = await prisma.payoutBatch.findFirstOrThrow({ where: { id: batchId, organizationId } });
    expect(persisted.status).toBe(PayoutBatchStatus.SUBMITTED_TO_PROVIDER);
    expect(await prisma.auditEvent.count({ where: { organizationId, entityId: batchId, action: 'BATCH_36_FORCED_AUDIT_FAILURE' } })).toBe(0);
  });

  it('persists a status transition and audit record together on success', async () => {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.payoutBatch.updateMany({
        where: { id: batchId, organizationId, status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER },
        data: { status: PayoutBatchStatus.RECONCILIATION_REQUIRED },
      });
      expect(changed.count).toBe(1);
      await tx.auditEvent.create({
        data: {
          actorUserId, organizationId, action: 'BATCH_36_TRANSACTION_COMMITTED',
          entityType: 'PayoutBatch', entityId: batchId, metadataJson: { test: true },
        },
      });
    });
    const persisted = await prisma.payoutBatch.findFirstOrThrow({ where: { id: batchId, organizationId } });
    expect(persisted.status).toBe(PayoutBatchStatus.RECONCILIATION_REQUIRED);
    expect(await prisma.auditEvent.count({ where: { organizationId, entityId: batchId, action: 'BATCH_36_TRANSACTION_COMMITTED' } })).toBe(1);
  });

  it('allows exactly one concurrent reconciliation transition and commits only its audit', async () => {
    const transition = (action: string) => prisma.$transaction(async (tx) => {
      const changed = await tx.payoutBatch.updateMany({
        where: { id: batchId, organizationId, status: PayoutBatchStatus.RECONCILIATION_REQUIRED },
        data: { status: PayoutBatchStatus.PARTIALLY_RECONCILED },
      });
      if (changed.count !== 1) throw new Error('BATCH_37_STALE_TRANSITION_CONFLICT');
      await tx.auditEvent.create({
        data: {
          actorUserId, organizationId, action,
          entityType: 'PayoutBatch', entityId: batchId, metadataJson: { test: true, batch: 37 },
        },
      });
    });

    const outcomes = await Promise.allSettled([
      transition('BATCH_37_CONCURRENT_WINNER_A'),
      transition('BATCH_37_CONCURRENT_WINNER_B'),
    ]);
    const fulfilled = outcomes.filter((result) => result.status === 'fulfilled');
    const rejected = outcomes.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const persisted = await prisma.payoutBatch.findFirstOrThrow({ where: { id: batchId, organizationId } });
    expect(persisted.status).toBe(PayoutBatchStatus.PARTIALLY_RECONCILED);
    const auditCount = await prisma.auditEvent.count({
      where: { organizationId, entityId: batchId, action: { in: ['BATCH_37_CONCURRENT_WINNER_A', 'BATCH_37_CONCURRENT_WINNER_B'] } },
    });
    expect(auditCount).toBe(1);
  });

  it('denies cross-tenant reconciliation and reopening after a committed state transition', async () => {
    const payouts = new PayoutsService(prisma);
    const maker: AuthenticatedUser = {
      sub: actorUserId, email: 'finance-integrity@example.test', organizationId,
      roles: [UserRole.FINANCE_MANAGER], sessionId: 'isolated-finance-test-session',
    };
    const priorAuditCount = await prisma.auditEvent.count({ where: { organizationId, entityId: batchId } });

    // Uses the real service against the real isolated MySQL record, not a Prisma mock.
    await expect(payouts.reconcile({
      ...maker, organizationId: 'unrelated-tenant-' + suffix,
    }, batchId, { items: [] })).rejects.toThrow('Payout batch not found.');

    await expect(payouts.requestApproval(maker, batchId))
      .rejects.toThrow('Only a non-empty draft batch can request approval.');

    // A stale writer must not reopen the previously transitioned batch.
    const stale = await prisma.payoutBatch.updateMany({
      where: { id: batchId, organizationId, status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER },
      data: { status: PayoutBatchStatus.RECONCILIATION_REQUIRED },
    });
    expect(stale.count).toBe(0);
    expect((await prisma.payoutBatch.findUniqueOrThrow({ where: { id: batchId } })).status)
      .toBe(PayoutBatchStatus.PARTIALLY_RECONCILED);
    expect(await prisma.auditEvent.count({ where: { organizationId, entityId: batchId } }))
      .toBe(priorAuditCount);
  });

});
