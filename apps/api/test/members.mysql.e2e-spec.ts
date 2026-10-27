import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BinarySide, UserRole, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_MYSQL_MEMBERS_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('SRS v1.0 non-financial member genealogy MySQL HTTP acceptance', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const memberIds: string[] = [];
  const tokens: Record<string, string> = {};
  const codes: Record<string, string> = {};
  let tenantA = '';
  let tenantB = '';
  let root = '';
  let left = '';
  let right = '';
  let spareOne = '';
  let spareTwo = '';
  let foreign = '';

  const makeUser = async (tenant: string, role: UserRole, slug: string) => {
    const user = await prisma.user.create({
      data: {
        organizationId: tenant,
        email: `genealogy-${slug}-${randomBytes(5).toString('hex')}@example.test`,
        displayName: 'Member Integrity Test',
        status: UserStatus.ACTIVE,
        roleAssignments: { create: [{ role }] },
      },
      select: { id: true, email: true },
    });
    userIds.push(user.id);
    const session = await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
      select: { id: true },
    });
    tokens[slug] = await jwt.signAsync({
      sub: user.id, sid: session.id, email: user.email, organizationId: tenant,
      roles: [role], typ: 'access',
    });
    return user;
  };

  const makeMember = async (tenant: string, slug: string) => {
    const user = await makeUser(tenant, UserRole.MEMBER, slug);
    const memberCode = 'MBR-' + randomBytes(8).toString('hex').toUpperCase();
    const member = await prisma.memberProfile.create({
      data: { organizationId: tenant, userId: user.id, memberCode },
      select: { id: true, memberCode: true },
    });
    memberIds.push(member.id);
    codes[slug] = member.memberCode;
    return member.id;
  };

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get('/api/v1' + path).set('Authorization', 'Bearer ' + token);

  beforeAll(async () => {
    const database = process.env.DATABASE_URL;
    if (process.env.NODE_ENV === 'production' || !database || !database.startsWith('mysql://') || !process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('Member E2E requires a disposable MySQL and non-production JWT secret.');
    }
    const parsed = new URL(database);
    if (!['127.0.0.1','localhost','::1','mysql84','mysql'].includes(parsed.hostname) && process.env.CI !== 'true') {
      throw new Error('Member E2E refuses nonlocal MySQL connections.');
    }
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET, signOptions: { expiresIn: '5m', algorithm: 'HS256' } });

    const suffix = randomBytes(8).toString('hex');
    const a = await prisma.organization.create({ data: { name: 'Genealogy Test A', slug: 'member-graph-a-' + suffix } });
    const b = await prisma.organization.create({ data: { name: 'Genealogy Test B', slug: 'member-graph-b-' + suffix } });
    orgIds.push(a.id, b.id); tenantA = a.id; tenantB = b.id;

    await makeUser(tenantA, UserRole.ORGANIZATION_ADMIN, 'adminA');
    await makeUser(tenantB, UserRole.ORGANIZATION_ADMIN, 'adminB');
    await makeUser(tenantB, UserRole.ADVERTISER, 'advertiserB');
    root = await makeMember(tenantA, 'root');
    left = await makeMember(tenantA, 'left');
    right = await makeMember(tenantA, 'right');
    spareOne = await makeMember(tenantA, 'spareOne');
    spareTwo = await makeMember(tenantA, 'spareTwo');
    foreign = await makeMember(tenantB, 'foreign');
    // Foreign tenant user without a member profile proves the composite FK,
    // rather than failing only on the globally unique userId field.
    await makeUser(tenantB, UserRole.MEMBER, 'unboundForeign');

    await prisma.binaryTreeRoot.create({ data: { organizationId: tenantA, memberId: root } });
    await prisma.binaryTreeRoot.create({ data: { organizationId: tenantB, memberId: foreign } });
    await prisma.sponsorRelationship.createMany({
      data: [
        { organizationId: tenantA, memberId: left, sponsorMemberId: root },
        { organizationId: tenantA, memberId: right, sponsorMemberId: root },
      ],
    });
    await prisma.placementNode.createMany({
      data: [
        { organizationId: tenantA, memberId: left, parentMemberId: root, side: BinarySide.LEFT },
        { organizationId: tenantA, memberId: right, parentMemberId: root, side: BinarySide.RIGHT },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      // Only test fixtures created by this suite are cleaned. No truncation or global reset.
      await prisma.placementNode.deleteMany({ where: { memberId: { in: memberIds } } });
      await prisma.sponsorRelationship.deleteMany({ where: { memberId: { in: memberIds } } });
      await prisma.binaryTreeRoot.deleteMany({ where: { memberId: { in: memberIds } } });
      await prisma.memberProfile.deleteMany({ where: { id: { in: memberIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    if (app) await app.close();
  }, 60_000);

  it('rejects unauthenticated and irrelevant-role member collection access', async () => {
    await request(app.getHttpServer()).get('/api/v1/members').expect(401);
    await get('/members', tokens['advertiserB']!).expect(403);
    await get('/members/me', tokens['adminA']!).expect(403);
  });

  it('returns real tenant-scoped member directory, bounded pagination, no PII', async () => {
    const a = await get('/members?take=2&skip=0', tokens['adminA']!).expect(200);
    expect(a.body.total).toBe(5);
    expect(a.body.items).toHaveLength(2);
    expect(JSON.stringify(a.body)).not.toContain(codes['foreign']);
    expect(JSON.stringify(a.body)).not.toContain('@example.test');
    const b = await get('/members', tokens['adminB']!).expect(200);
    expect(b.body.total).toBe(1);
    expect(b.body.items[0].memberCode).toBe(codes['foreign']);
    await get('/members?take=1000', tokens['adminA']!).expect(400);
    await get('/members?skip=-1', tokens['adminA']!).expect(400);
    await get('/members?take=nan', tokens['adminA']!).expect(400);
  });

  it('returns sponsor and placement parent separately, without cross-tenant lookup', async () => {
    const own = await get('/members/' + codes['left'], tokens['adminA']!).expect(200);
    expect(own.body).toMatchObject({
      memberCode: codes['left'], sponsorMemberCode: codes['root'],
      placementParentMemberCode: codes['root'], placementSide: 'LEFT', isTreeRoot: false,
      status: 'PENDING_ACTIVATION',
    });
    const rootRes = await get('/members/' + codes['root'], tokens['adminA']!).expect(200);
    expect(rootRes.body.isTreeRoot).toBe(true);
    await get('/members/' + codes['foreign'], tokens['adminA']!).expect(404);
    await get('/members/' + codes['left'], tokens['adminB']!).expect(404);
  });

  it('lets a member see only their own profile and authorized descendants', async () => {
    const own = await get('/members/me', tokens['left']!).expect(200);
    expect(own.body.memberCode).toBe(codes['left']);
    await get('/members/' + codes['root'], tokens['left']!).expect(403);
    await get('/members', tokens['left']!).expect(403);
    const subtree = await get('/members/me/tree?depth=4', tokens['left']!).expect(200);
    expect(subtree.body.nodes).toHaveLength(1);
    expect(subtree.body.rootMemberCode).toBe(codes['left']);
    expect(JSON.stringify(subtree.body)).not.toContain(codes['right']);
    expect(JSON.stringify(subtree.body)).not.toContain(codes['foreign']);
    await get('/members/me/tree?depth=9', tokens['left']!).expect(400);
    await get('/members/me', tokens['unboundForeign']!).expect(404);
  });

  it('builds a bounded server-derived LEFT/RIGHT tree without spoofable names', async () => {
    const tree = await get('/members/' + codes['root'] + '/tree?depth=2', tokens['adminA']!).expect(200);
    expect(tree.body.nodes).toHaveLength(3);
    expect(tree.body.nodes.filter((x: { depth: number }) => x.depth === 1).map((x: { side: string }) => x.side).sort()).toEqual(['LEFT','RIGHT']);
    expect(JSON.stringify(tree.body)).not.toContain(codes['foreign']);
    expect(JSON.stringify(tree.body)).not.toContain('email');
  });

  it('enforces one direct LEFT slot under genuine concurrent MySQL writes', async () => {
    const results = await Promise.allSettled([
      prisma.placementNode.create({ data: { organizationId: tenantA, memberId: spareOne, parentMemberId: left, side: BinarySide.LEFT } }),
      prisma.placementNode.create({ data: { organizationId: tenantA, memberId: spareTwo, parentMemberId: left, side: BinarySide.LEFT } }),
    ]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect(await prisma.placementNode.count({ where: { organizationId: tenantA, parentMemberId: left, side: BinarySide.LEFT } })).toBe(1);
    // The other membership has no ghost placement row.
    const tree = await get('/members/' + codes['left'] + '/tree?depth=1', tokens['adminA']!).expect(200);
    expect(tree.body.nodes).toHaveLength(2);
  });

  it('rejects cross-tenant sponsor, placement and member-user associations at FK layer', async () => {
    await expect(prisma.sponsorRelationship.create({
      data: { organizationId: tenantA, memberId: spareTwo, sponsorMemberId: foreign },
    })).rejects.toThrow();
    await expect(prisma.placementNode.create({
      data: { organizationId: tenantA, memberId: spareTwo, parentMemberId: foreign, side: BinarySide.RIGHT },
    })).rejects.toThrow();
    await expect(prisma.memberProfile.create({
      data: { organizationId: tenantA, userId: userIds[userIds.length-1]!, memberCode: 'CROSS-TENANT-BLOCK' },
    })).rejects.toThrow();
  });

  it('rejects self-sponsorship and self-placement in MySQL check constraints', async () => {
    await expect(prisma.sponsorRelationship.create({
      data: { organizationId: tenantA, memberId: spareOne, sponsorMemberId: spareOne },
    })).rejects.toThrow();
    // Two already-placed members cannot gain another parent or self-parent.
    await expect(prisma.placementNode.create({
      data: { organizationId: tenantA, memberId: root, parentMemberId: root, side: BinarySide.LEFT },
    })).rejects.toThrow();
  });
});
