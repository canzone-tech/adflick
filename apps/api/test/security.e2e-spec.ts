import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as request from 'supertest';
import { createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_MYSQL_SECURITY_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('MySQL-backed security HTTP acceptance (disposable database only)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let organizationA: { id: string; slug: string };
  let organizationB: { id: string; slug: string };
  let adminUser: { id: string; email: string };
  let advertiserUser: { id: string; email: string };
  let adminToken: string;
  let advertiserToken: string;
  let foreignCampaign: { id: string; name: string };
  let foreignAsset: { id: string; title: string };
  let foreignScreen: { id: string; name: string };
  let foreignLayout: { id: string; name: string };
  let foreignIncident: { id: string; title: string };
  let foreignPayoutBatch: { id: string; batchReference: string };
  const secret = process.env.JWT_ACCESS_SECRET;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !secret || secret.length < 32) {
      throw new Error('Security E2E requires DATABASE_URL and JWT_ACCESS_SECRET (minimum 32 characters).');
    }
    if (!process.env.DATABASE_URL.startsWith('mysql://')) {
      throw new Error('Security E2E must run against MySQL, never another database provider.');
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = new JwtService({ secret, signOptions: { algorithm: 'HS256', expiresIn: '5m' } });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    organizationA = await prisma.organization.create({
      data: { name: `Batch 27 Org A ${suffix}`, slug: `batch27-a-${suffix}` },
      select: { id: true, slug: true },
    });
    organizationB = await prisma.organization.create({
      data: { name: `Batch 27 Org B ${suffix}`, slug: `batch27-b-${suffix}` },
      select: { id: true, slug: true },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `batch27-admin-${suffix}@example.test`, displayName: 'Batch 27 Test Admin',
        status: UserStatus.ACTIVE, organizationId: organizationA.id,
        roleAssignments: { create: [{ role: UserRole.ORGANIZATION_ADMIN }] },
      },
      select: { id: true, email: true },
    });
    advertiserUser = await prisma.user.create({
      data: {
        email: `batch27-advertiser-${suffix}@example.test`, displayName: 'Batch 27 Test Advertiser',
        status: UserStatus.ACTIVE, organizationId: organizationB.id,
        roleAssignments: { create: [{ role: UserRole.ADVERTISER }] },
      },
      select: { id: true, email: true },
    });

    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const adminSession = await prisma.refreshSession.create({
      data: { userId: adminUser.id, tokenHash: createHash('sha256').update(`batch27-admin-${suffix}`).digest('hex'), expiresAt },
      select: { id: true },
    });
    const advertiserSession = await prisma.refreshSession.create({
      data: { userId: advertiserUser.id, tokenHash: createHash('sha256').update(`batch27-advertiser-${suffix}`).digest('hex'), expiresAt },
      select: { id: true },
    });
    adminToken = await jwt.signAsync({
      sub: adminUser.id, sid: adminSession.id, email: adminUser.email,
      organizationId: organizationA.id, roles: [UserRole.ORGANIZATION_ADMIN], typ: 'access',
    });
    advertiserToken = await jwt.signAsync({
      sub: advertiserUser.id, sid: advertiserSession.id, email: advertiserUser.email,
      organizationId: organizationB.id, roles: [UserRole.ADVERTISER], typ: 'access',
    });

    // Cross-tenant fixtures belong exclusively to Organization B.
    foreignCampaign = await prisma.campaign.create({
      data: { organizationId: organizationB.id, name: `Foreign campaign ${suffix}`, createdById: advertiserUser.id },
      select: { id: true, name: true },
    });
    foreignAsset = await prisma.mediaAsset.create({
      data: {
        organizationId: organizationB.id, uploadedById: advertiserUser.id,
        title: `Foreign asset ${suffix}`, originalName: 'foreign.jpg',
        mimeType: 'image/jpeg', sizeBytes: BigInt(1024), status: 'READY',
      },
      select: { id: true, title: true },
    });
    foreignScreen = await prisma.screen.create({
      data: {
        organizationId: organizationB.id, name: `Foreign screen ${suffix}`,
        platform: 'ANDROID_TV', status: 'ONLINE',
      },
      select: { id: true, name: true },
    });
    foreignLayout = await prisma.screenLayout.create({
      data: {
        organizationId: organizationB.id, createdById: advertiserUser.id,
        name: `Foreign layout ${suffix}`, zonesJson: [],
      },
      select: { id: true, name: true },
    });
    foreignIncident = await prisma.incident.create({
      data: {
        organizationId: organizationB.id, screenId: foreignScreen.id,
        title: `Foreign incident ${suffix}`, openedById: advertiserUser.id,
      },
      select: { id: true, title: true },
    });
    foreignPayoutBatch = await prisma.payoutBatch.create({
      data: {
        organizationId: organizationB.id,
        batchReference: `B27-${suffix}`.slice(0, 80),
        createdById: advertiserUser.id, providerName: 'SANDBOX',
      },
      select: { id: true, batchReference: true },
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma && foreignPayoutBatch) await prisma.payoutBatch.deleteMany({ where: { id: foreignPayoutBatch.id } });
    if (prisma && foreignIncident) await prisma.incident.deleteMany({ where: { id: foreignIncident.id } });
    if (prisma && foreignLayout) await prisma.screenLayout.deleteMany({ where: { id: foreignLayout.id } });
    if (prisma && foreignCampaign) await prisma.campaign.deleteMany({ where: { id: foreignCampaign.id } });
    if (prisma && foreignAsset) await prisma.mediaAsset.deleteMany({ where: { id: foreignAsset.id } });
    if (prisma && foreignScreen) await prisma.screen.deleteMany({ where: { id: foreignScreen.id } });
    if (prisma && adminUser && advertiserUser) {
      await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, advertiserUser.id] } } });
    }
    if (prisma && organizationA && organizationB) {
      await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    }
    if (app) await app.close();
  }, 30_000);

  it('returns 401 for protected route without a bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/access/admin-check').expect(401);
  });

  it('allows an organization admin with a valid active database session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/access/admin-check')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ success: true, userId: adminUser.id });
  });

  it('rejects an advertiser at an organization-admin-only route', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/access/admin-check')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .expect(403);
  });

  it('does not expose Organization B records in Organization A collection endpoints', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const cases = [
      { path: '/api/v1/campaigns', id: foreignCampaign.id },
      { path: '/api/v1/cms/assets', id: foreignAsset.id },
      { path: '/api/v1/cms/layouts', id: foreignLayout.id },
      { path: '/api/v1/fleet/screens', id: foreignScreen.id },
      { path: '/api/v1/incidents', id: foreignIncident.id },
      { path: '/api/v1/finance/payout-batches', id: foreignPayoutBatch.id },
    ];
    for (const item of cases) {
      const response = await request(app.getHttpServer()).get(item.path).set(headers).expect(200);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(item.id);
    }
  });

  it('rejects cross-tenant mutations and verifies Organization B rows remain unchanged', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    await request(app.getHttpServer()).patch(`/api/v1/campaigns/${foreignCampaign.id}`)
      .set(headers).send({ name: 'Unauthorized campaign mutation' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/cms/layouts/${foreignLayout.id}/publish`)
      .set(headers).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/fleet/screens/${foreignScreen.id}/status`)
      .set(headers).send({ status: 'SUSPENDED' }).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/incidents/${foreignIncident.id}`)
      .set(headers).send({ status: 'RESOLVED' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/finance/payout-batches/${foreignPayoutBatch.id}/decision`)
      .set(headers).send({ status: 'APPROVED', note: 'Unauthorized cross-tenant attempt' }).expect(404);

    expect(await prisma.campaign.findUnique({ where: { id: foreignCampaign.id }, select: { name: true } }))
      .toEqual({ name: foreignCampaign.name });
    expect(await prisma.screenLayout.findUnique({ where: { id: foreignLayout.id }, select: { status: true } }))
      .toEqual({ status: 'DRAFT' });
    expect(await prisma.screen.findUnique({ where: { id: foreignScreen.id }, select: { status: true } }))
      .toEqual({ status: 'ONLINE' });
    expect(await prisma.incident.findUnique({ where: { id: foreignIncident.id }, select: { status: true } }))
      .toEqual({ status: 'OPEN' });
    expect(await prisma.payoutBatch.findUnique({ where: { id: foreignPayoutBatch.id }, select: { status: true } }))
      .toEqual({ status: 'DRAFT' });
  });

  it('rejects an otherwise valid token whose database session has been revoked', async () => {
    const session = await prisma.refreshSession.findFirst({
      where: { userId: adminUser.id }, select: { id: true },
    });
    expect(session).not.toBeNull();
    await prisma.refreshSession.update({ where: { id: session!.id }, data: { revokedAt: new Date() } });
    await request(app.getHttpServer())
      .get('/api/v1/access/admin-check')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });
});
