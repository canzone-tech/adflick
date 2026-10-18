import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus, ReconciliationImportStatus } from '@prisma/client';
import * as request from 'supertest';
import { createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_MYSQL_FINANCE_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('Reconciliation import authenticated HTTP E2E (disposable local MySQL 8.4 only)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let orgA: { id: string; slug: string };
  let orgB: { id: string; slug: string };
  let financeUser: { id: string; email: string };
  let auditorUser: { id: string; email: string };
  let advertiserUser: { id: string; email: string };
  let financeToken: string;
  let auditorToken: string;
  let advertiserToken: string;
  let importAId: string;
  let importBId: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const secret = process.env.JWT_ACCESS_SECRET;
  const sessionIds: string[] = [];

  async function createIdentity(orgId: string, role: UserRole, label: string) {
    const user = await prisma.user.create({ data: {
      organizationId: orgId,
      email: `b45-${label}-${suffix}@example.test`,
      displayName: `Batch 45 ${label}`,
      status: UserStatus.ACTIVE,
      roleAssignments: { create: [{ role }] },
    }, select: { id: true, email: true } });
    const session = await prisma.refreshSession.create({ data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(`b45-${label}-${suffix}`).digest('hex'),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    }, select: { id: true } });
    sessionIds.push(session.id);
    const token = await jwt.signAsync({ sub: user.id, sid: session.id, email: user.email,
      organizationId: orgId, roles: [role], typ: 'access' });
    return { user, token };
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.startsWith('mysql://') || !secret || secret.length < 32) {
      throw new Error('Batch 45 HTTP E2E requires a MySQL DATABASE_URL and JWT_ACCESS_SECRET of at least 32 characters.');
    }
    if (!process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost')) {
      throw new Error('Refusing non-local database. Use a disposable local MySQL 8.4 test database.');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = new JwtService({ secret, signOptions: { algorithm: 'HS256', expiresIn: '5m' } });

    orgA = await prisma.organization.create({ data: { name: `Batch 45 A ${suffix}`, slug: `b45-a-${suffix}` }, select: { id: true, slug: true } });
    orgB = await prisma.organization.create({ data: { name: `Batch 45 B ${suffix}`, slug: `b45-b-${suffix}` }, select: { id: true, slug: true } });
    const finance = await createIdentity(orgA.id, UserRole.FINANCE_MANAGER, 'finance');
    financeUser = finance.user; financeToken = finance.token;
    const auditor = await createIdentity(orgA.id, UserRole.AUDITOR_COMPLIANCE, 'auditor');
    auditorUser = auditor.user; auditorToken = auditor.token;
    const advertiser = await createIdentity(orgA.id, UserRole.ADVERTISER, 'advertiser');
    advertiserUser = advertiser.user; advertiserToken = advertiser.token;

    const recordA = await prisma.reconciliationImport.create({ data: {
      organizationId: orgA.id, providerName: 'BATCH45_SANDBOX', idempotencyKey: `org-a-${suffix}`,
      payloadSha256: createHash('sha256').update('batch45-fixture-a').digest('hex'), status: ReconciliationImportStatus.COMPLETED,
      rowCount: 2, matchedCount: 1, discrepancyCount: 1, createdById: financeUser.id, completedAt: new Date(),
      rows: { create: [
        { organizationId: orgA.id, rowNumber: 2, providerReference: 'provider-match', payoutReference: 'payout-a', amountPaise: 12500, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'MATCH' },
        { organizationId: orgA.id, rowNumber: 3, providerReference: 'provider-diff', payoutReference: 'payout-b', amountPaise: 9900, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'AMOUNT_MISMATCH', detail: 'Amount differs' },
      ] },
    }, select: { id: true } });
    importAId = recordA.id;
    const recordB = await prisma.reconciliationImport.create({ data: {
      organizationId: orgB.id, providerName: 'BATCH45_SANDBOX', idempotencyKey: `org-b-${suffix}`,
      payloadSha256: createHash('sha256').update('batch45-fixture-b').digest('hex'), status: ReconciliationImportStatus.COMPLETED,
      rowCount: 1, matchedCount: 1, createdById: null, completedAt: new Date(),
      rows: { create: [{ organizationId: orgB.id, rowNumber: 2, providerReference: 'foreign-provider', payoutReference: 'foreign-payout', amountPaise: 3000, currency: 'INR', statementStatus: 'SUCCESS', outcome: 'MATCH' }] },
    }, select: { id: true } });
    importBId = recordB.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma && importAId) await prisma.reconciliationImportRow.deleteMany({ where: { importId: importAId } });
    if (prisma && importBId) await prisma.reconciliationImportRow.deleteMany({ where: { importId: importBId } });
    if (prisma && importAId) await prisma.reconciliationImport.deleteMany({ where: { id: importAId } });
    if (prisma && importBId) await prisma.reconciliationImport.deleteMany({ where: { id: importBId } });
    if (prisma && sessionIds.length) await prisma.refreshSession.deleteMany({ where: { id: { in: sessionIds } } });
    if (prisma && [financeUser?.id, auditorUser?.id, advertiserUser?.id].filter(Boolean).length) {
      await prisma.user.deleteMany({ where: { id: { in: [financeUser?.id, auditorUser?.id, advertiserUser?.id].filter(Boolean) as string[] } } });
    }
    if (prisma && orgA?.id) await prisma.organization.deleteMany({ where: { id: orgA.id } });
    if (prisma && orgB?.id) await prisma.organization.deleteMany({ where: { id: orgB.id } });
    if (app) await app.close();
  }, 30_000);

  it('requires authentication for reconciliation detail and rows endpoints', async () => {
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}`).expect(401);
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}/rows`).expect(401);
  });

  it('returns persisted import totals and discrepancy rows through the real HTTP API', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}`)
      .set('Authorization', `Bearer ${financeToken}`).expect(200);
    expect(detail.body).toMatchObject({ id: importAId, status: 'COMPLETED', rowCount: 2, matchedCount: 1, discrepancyCount: 1 });
    const rows = await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}/rows?limit=1&offset=1`)
      .set('Authorization', `Bearer ${financeToken}`).expect(200);
    expect(rows.body).toMatchObject({ importId: importAId, limit: 1, offset: 1, total: 2 });
    expect(rows.body.rows).toHaveLength(1);
    expect(rows.body.rows[0]).toMatchObject({ rowNumber: 3, outcome: 'AMOUNT_MISMATCH', detail: 'Amount differs' });
  });

  it('allows auditor read access but blocks advertiser access to finance reads and writes', async () => {
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}`)
      .set('Authorization', `Bearer ${auditorToken}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}`)
      .set('Authorization', `Bearer ${advertiserToken}`).expect(403);
    await request(app.getHttpServer()).post('/api/v1/finance/reconciliation-imports/process')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({ providerName: 'BATCH45_SANDBOX', idempotencyKey: `blocked-${suffix}`, payload: 'payoutReference,providerReference,amountPaise,currency,status\np-1,r-1,100,INR,SUCCESS' })
      .expect(403);
  });

  it('returns not found for foreign-tenant import detail and rows', async () => {
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importBId}`)
      .set('Authorization', `Bearer ${financeToken}`).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importBId}/rows`)
      .set('Authorization', `Bearer ${financeToken}`).expect(404);
  });

  it('rejects invalid pagination and confirms the persisted source rows remain unchanged', async () => {
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}/rows?limit=201`)
      .set('Authorization', `Bearer ${financeToken}`).expect(400);
    await request(app.getHttpServer()).get(`/api/v1/finance/reconciliation-imports/${importAId}/rows?offset=-1`)
      .set('Authorization', `Bearer ${financeToken}`).expect(400);
    expect(await prisma.reconciliationImportRow.count({ where: { importId: importAId, organizationId: orgA.id } })).toBe(2);
    expect(await prisma.reconciliationImportRow.count({ where: { importId: importBId, organizationId: orgB.id } })).toBe(1);
  });
});
