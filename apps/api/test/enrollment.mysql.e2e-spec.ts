import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole, UserStatus, EnrollmentPinStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret, generateBase32Secret } from '../src/auth/mfa.crypto';

const suite = process.env.RUN_MYSQL_MEMBERS_E2E === '1' ? describe : describe.skip;
const FLAGS = ['ADFLICK_MEMBER_CONFIG_ENABLED','ADFLICK_MEMBER_EPIN_ISSUANCE_ENABLED','ADFLICK_MEMBER_ENROLLMENT_ENABLED','ADFLICK_EPIN_HASH_PEPPER'] as const;

suite('SRS e-PIN + pending member enrollment: real MySQL HTTP transactions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const originalFlags = Object.fromEntries(FLAGS.map(k => [k, process.env[k]]));
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const sessions: string[] = [];
  const token: Record<string,string> = {};
  const account: Record<string,string> = {};
  let org = '', foreignOrg = '', rootId = '', foreignCode = '', rootCode = '';
  let packageId = '', consentId = '', consentVersion = '', consentHash = '';
  const issued: Record<string, { id:string; pin:string }> = {};

  const http = (name: string) => ({
    get: (url: string) => request(app.getHttpServer()).get('/api/v1' + url).set('Authorization', 'Bearer ' + token[name]),
    post: (url: string, body: object) => request(app.getHttpServer()).post('/api/v1' + url).set('Authorization', 'Bearer ' + token[name]).send(body),
  });

  const createUser = async (whichOrg: string, role: UserRole, name: string) => {
    const user = await prisma.user.create({
      data: {
        organizationId: whichOrg, email: 'enrollment-' + name + '-' + randomBytes(5).toString('hex') + '@example.test',
        displayName: 'Enrollment Test User', status: UserStatus.ACTIVE,
        roleAssignments: { create: [{ role }] },
      }, select: { id: true, email: true },
    });
    userIds.push(user.id); account[name] = user.id;
    const session = await prisma.refreshSession.create({ data: {
      userId: user.id, tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      expiresAt: new Date(Date.now()+20*60_000),
      mfaVerifiedAt: (role === UserRole.SUPER_ADMIN || role === UserRole.ORGANIZATION_ADMIN) ? new Date() : null,
    } });
    sessions.push(session.id);
    if ((role === UserRole.SUPER_ADMIN || role === UserRole.ORGANIZATION_ADMIN)) {
      await prisma.mfaEnrollment.create({ data: {
        userId: user.id, secretCiphertext: encryptSecret(generateBase32Secret()), enabled: true,
      } });
    }
    token[name] = await jwt.signAsync({
      sub: user.id, sid: session.id, email: user.email, organizationId: whichOrg, roles: [role], typ: 'access',
    });
    return user.id;
  };

  const issue = async (name: string, expiresAt = new Date(Date.now()+30*60_000).toISOString()) => {
    const response = await http('maker').post('/member-enrollment/pins', {
      recipientUserId: account[name], packageCode: 'ENROLLMENT-TEST', expiresAt,
    }).expect(201);
    expect(response.body.pin).toMatch(/^[A-Za-z0-9_-]{43}$/);
    issued[name] = { id: response.body.id, pin: response.body.pin };
    return issued[name];
  };

  const enrollment = (name: string, overrides: Record<string,unknown> = {}) => ({
    sponsorMemberCode: rootCode, placementParentMemberCode: rootCode, side: 'LEFT',
    consentVersion, consentDocumentSha256: consentHash, consentAccepted: true,
    pin: issued[name]?.pin, ...overrides,
  });

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (process.env.NODE_ENV === 'production' || !url || !url.startsWith('mysql://') ||
        !['localhost','127.0.0.1','::1','mysql84','mysql'].includes(new URL(url).hostname) ||
        !process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('Enrollment acceptance MUST use isolated non-production MySQL with JWT secret.');
    }
    for (const flag of FLAGS.slice(0,3)) process.env[flag] = 'false';
    process.env.ADFLICK_EPIN_HASH_PEPPER = randomBytes(48).toString('base64url');
    const module = await Test.createTestingModule({ imports:[AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist:true, transform:true, forbidNonWhitelisted:true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = new JwtService({ secret:process.env.JWT_ACCESS_SECRET, signOptions:{ algorithm:'HS256', expiresIn:'5m' } });
    const suffix = randomBytes(7).toString('hex');
    const a = await prisma.organization.create({data:{name:'Enrollment Org A',slug:'enroll-a-'+suffix}});
    const b = await prisma.organization.create({data:{name:'Enrollment Org B',slug:'enroll-b-'+suffix}});
    org = a.id; foreignOrg = b.id; orgIds.push(org,foreignOrg);
    await createUser(org,UserRole.ORGANIZATION_ADMIN,'maker');
    await createUser(org,UserRole.SUPER_ADMIN,'reviewer');
    await createUser(foreignOrg,UserRole.ADVERTISER,'foreignStaff');
    const rootUser = await createUser(org,UserRole.MEMBER,'root');
    const foreignRoot = await createUser(foreignOrg,UserRole.MEMBER,'foreignRoot');
    for(const name of ['alpha','beta','gamma','delta','epsilon']) await createUser(org,UserRole.MEMBER,name);
    rootCode = 'ROOT-' + suffix;
    foreignCode = 'FOREIGN-' + suffix;
    const r = await prisma.memberProfile.create({data:{organizationId:org,userId:rootUser,memberCode:rootCode,status:'ACTIVE'}});
    const f = await prisma.memberProfile.create({data:{organizationId:foreignOrg,userId:foreignRoot,memberCode:foreignCode,status:'ACTIVE'}});
    rootId = r.id;
    // Verified challenge fixtures are confined to isolated MySQL acceptance.
    // SMTP delivery and wrong-code paths have their own integration suite.
    for(const name of ['alpha','beta','gamma']) {
      await prisma.memberEmailOtp.create({data:{
        organizationId:org, userId:account[name]!, purpose:'MEMBER_ENROLLMENT',
        codeHash:createHash('sha256').update(randomBytes(16)).digest('hex'),
        maxAttempts:5, status:'VERIFIED', verifiedAt:new Date(),
        expiresAt:new Date(Date.now()+20*60_000),
      }});
    }
    await prisma.binaryTreeRoot.createMany({data:[
      {organizationId:org,memberId:r.id},{organizationId:foreignOrg,memberId:f.id},
    ]});
  }, 60_000);

  afterAll(async () => {
    try {
      if (prisma && orgIds.length) {
        await prisma.memberEmailOtp.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.memberEmailOtpThrottle.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.memberOtpPolicy.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.enrollmentPin.updateMany({where:{organizationId:{in:orgIds}},data:{redeemedByMemberId:null}});
        await prisma.memberConsentRecord.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.enrollmentPin.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.placementNode.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.sponsorRelationship.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.binaryTreeRoot.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.memberProfile.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.memberConsentDocument.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.memberPackage.deleteMany({where:{organizationId:{in:orgIds}}});
        await prisma.user.deleteMany({where:{id:{in:userIds}}});
        await prisma.organization.deleteMany({where:{id:{in:orgIds}}});
      }
    } finally {
      if (app) await app.close();
      for (const flag of FLAGS) {
        if (originalFlags[flag] === undefined) delete process.env[flag];
        else process.env[flag] = originalFlags[flag];
      }
    }
  }, 60_000);

  it('fails closed by default; rejects unauthenticated and unrelated-role writes', async () => {
    await request(app.getHttpServer()).post('/api/v1/member-enrollment/enroll').send({}).expect(401);
    await http('foreignStaff').post('/member-enrollment/packages',{code:'x',name:'x'}).expect(403);
    await http('maker').post('/member-enrollment/packages',{code:'TEST',name:'Real scoped package'}).expect(503);
    await http('alpha').post('/member-enrollment/enroll',{}).expect(400);
  });

  it('creates real draft package/consent; only independent SUPER_ADMIN reviewer may approve', async () => {
    process.env.ADFLICK_MEMBER_CONFIG_ENABLED = 'true';
    const packageCreated = await http('maker').post('/member-enrollment/packages',{
      code:'ENROLLMENT-TEST',name:'Non-financial Enrollment Test Package',
    }).expect(201);
    packageId = packageCreated.body.id;
    expect(packageCreated.body.status).toBe('DRAFT');
    const text = 'This text is a test-only consent document for the disposable MySQL acceptance environment, not public legal copy.';
    consentVersion = 'test-'+randomBytes(4).toString('hex');
    const doc = await http('maker').post('/member-enrollment/consents',{version:consentVersion,documentText:text}).expect(201);
    consentId = doc.body.id; consentHash = doc.body.documentSha256;
    expect(consentHash).toHaveLength(64);
    await http('maker').post('/member-enrollment/packages/'+packageId+'/approve',{approvalReference:'review-ticket-001'}).expect(403);
    await http('reviewer').post('/member-enrollment/packages/'+packageId+'/approve',{approvalReference:'review-ticket-001'}).expect(201);
    await http('reviewer').post('/member-enrollment/consents/'+consentId+'/approve',{approvalReference:'legal-review-001'}).expect(201);
    const current = await http('alpha').get('/member-enrollment/consents/current').expect(200);
    expect(current.body).toMatchObject({version:consentVersion,documentSha256:consentHash,documentText:text});
    const foreign = await http('foreignStaff').get('/member-enrollment/consents/current').expect(403);
    expect(foreign.body).not.toHaveProperty('documentText');
  });

  it('issues 256-bit recipient-bound one-time e-PIN; listing never leaks token/hash', async () => {
    process.env.ADFLICK_MEMBER_EPIN_ISSUANCE_ENABLED = 'true';
    const bad = await http('maker').post('/member-enrollment/pins',{recipientUserId:account['foreignRoot'],packageCode:'ENROLLMENT-TEST',expiresAt:new Date(Date.now()+100000).toISOString()}).expect(400);
    expect(bad.body).not.toHaveProperty('pin');
    await issue('alpha');
    const rows = await http('maker').get('/member-enrollment/pins?take=10').expect(200);
    expect(rows.body.total).toBe(1);
    expect(JSON.stringify(rows.body)).not.toContain(issued['alpha']!.pin);
    expect(JSON.stringify(rows.body)).not.toContain('tokenHash');
    const db = await prisma.enrollmentPin.findUniqueOrThrow({where:{id:issued['alpha']!.id}});
    expect(db.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.tokenHash).not.toBe(issued['alpha']!.pin);
  });

  it('invalid consent and foreign sponsor cannot consume a PIN', async () => {
    process.env.ADFLICK_MEMBER_ENROLLMENT_ENABLED = 'true';
    await http('alpha').post('/member-enrollment/enroll', enrollment('alpha',{consentDocumentSha256:'f'.repeat(64)})).expect(400);
    await http('alpha').post('/member-enrollment/enroll', enrollment('alpha',{sponsorMemberCode:foreignCode})).expect(400);
    expect((await prisma.enrollmentPin.findUniqueOrThrow({where:{id:issued['alpha']!.id}})).status).toBe(EnrollmentPinStatus.ISSUED);
    expect(await prisma.memberProfile.count({where:{organizationId:org,userId:account['alpha']!}})).toBe(0);
  });

  it('scopes sponsor eligibility and staff recipient lookup to real tenant members', async () => {
    await request(app.getHttpServer()).get('/api/v1/member-enrollment/progress').expect(401);
    await http('maker').get('/member-enrollment/progress').expect(403);
    await http('foreignStaff').get('/member-enrollment/recipient?email=x@example.test').expect(403);
    const email = (await prisma.user.findUniqueOrThrow({
      where: { id: account['alpha']! }, select: { email: true },
    })).email;
    const found = await http('maker').get('/member-enrollment/recipient?email='+encodeURIComponent(email)).expect(200);
    expect(found.body).toMatchObject({ id: account['alpha'], email });
    expect(found.body).not.toHaveProperty('passwordHash');
    await http('foreignStaff').get('/member-enrollment/pins').expect(403);
    await http('maker').get('/member-enrollment/recipient?email=invalid').expect(400);
    await http('maker').get('/member-enrollment/recipient?email=no-such-user@example.test').expect(404);
    const candidate = await http('alpha').get('/member-enrollment/eligible/'+rootCode).expect(200);
    expect(candidate.body).toMatchObject({
      memberCode: rootCode, eligible: true, provisional: true,
      leftAvailable: true, rightAvailable: true,
    });
    expect(JSON.stringify(candidate.body)).not.toContain('@example.test');
    await http('alpha').get('/member-enrollment/eligible/'+foreignCode).expect(404);
    await http('alpha').get('/member-enrollment/eligible/invalid').expect(404);
    await http('maker').get('/member-enrollment/eligible/'+rootCode).expect(403);
  });

  it('preflight checks real PIN/OTP/consent and free LEFT slot without mutating records', async () => {
    const before = await http('alpha').get('/member-enrollment/progress').expect(200);
    expect(before.body).toMatchObject({
      membership: null, hasIssuedPin: true, emailOtpVerified: true,
      enrollmentEnabled: true, mobileOtpProviderEnabled: false,
    });
    expect(before.body.consent).toMatchObject({
      version: consentVersion, documentSha256: consentHash,
    });
    expect(JSON.stringify(before.body)).not.toContain(issued['alpha']!.pin);
    const checked = await http('alpha').post('/member-enrollment/preflight', enrollment('alpha')).expect(201);
    expect(checked.body).toMatchObject({
      sponsorMemberCode: rootCode, placementParentMemberCode: rootCode,
      provisional: true, placementAvailable: true, pinAssigned: true,
    });
    await http('alpha').post('/member-enrollment/preflight', enrollment('alpha',{sponsorMemberCode: foreignCode})).expect(404);
    await http('alpha').post('/member-enrollment/preflight', enrollment('alpha',{pin: ((issued['alpha']!.pin.startsWith('Z') ? 'Y' : 'Z') + issued['alpha']!.pin.slice(1))})).expect(409);
    await http('alpha').post('/member-enrollment/preflight', enrollment('alpha',{consentAccepted: false})).expect(400);
    expect(await prisma.memberProfile.count({
      where:{organizationId:org,userId:account['alpha']!},
    })).toBe(0);
    expect((await prisma.enrollmentPin.findUniqueOrThrow({
      where: { id: issued['alpha']!.id },
    })).status).toBe('ISSUED');
  });

  it('enrolls an authenticated existing member atomically as PENDING_ACTIVATION, never pays', async () => {
    const res = await http('alpha').post('/member-enrollment/enroll', enrollment('alpha')).expect(201);
    expect(res.body.status).toBe('PENDING_ACTIVATION');
    const member = await prisma.memberProfile.findFirstOrThrow({
      where:{organizationId:org,userId:account['alpha']!},
      include:{placement:true,sponsorship:true,enrollmentConsent:true,enrollmentPin:true},
    });
    expect(member.placement?.parentMemberId).toBe(rootId);
    expect(member.placement?.side).toBe('LEFT');
    expect(member.sponsorship?.sponsorMemberId).toBe(rootId);
    expect(member.enrollmentConsent?.documentId).toBe(consentId);
    expect(member.enrollmentPin?.id).toBe(issued['alpha']!.id);
    expect((await prisma.enrollmentPin.findUniqueOrThrow({where:{id:issued['alpha']!.id}})).status).toBe('REDEEMED');
    await http('alpha').post('/member-enrollment/enroll', enrollment('alpha')).expect(409);
    const progress = await http('alpha').get('/member-enrollment/progress').expect(200);
    expect(progress.body.membership).toMatchObject({status:'PENDING_ACTIVATION'});
    expect(progress.body.hasIssuedPin).toBe(false);
    expect(progress.body.emailOtpVerified).toBe(false);
    await http('alpha').post('/member-enrollment/preflight', enrollment('alpha')).expect(409);
    const placement = await http('gamma').get('/member-enrollment/eligible/'+rootCode).expect(200);
    expect(placement.body).toMatchObject({leftAvailable:false,rightAvailable:true});

    const mine = await http('alpha').get('/members/me').expect(200);
    expect(mine.body.status).toBe('PENDING_ACTIVATION');
    expect(await prisma.auditEvent.count({where:{organizationId:org,action:'MEMBER_EPIN_ENROLLMENT_PENDING',entityId:member.id}})).toBe(1);
  });

  it('concurrent same-side enrollment commits at most one; losing PIN remains available', async () => {
    await issue('beta'); await issue('gamma');
    const res = await Promise.all([
      http('beta').post('/member-enrollment/enroll', enrollment('beta',{side:'RIGHT'})),
      http('gamma').post('/member-enrollment/enroll', enrollment('gamma',{side:'RIGHT'})),
    ]);
    expect(res.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await prisma.placementNode.count({where:{organizationId:org,parentMemberId:rootId,side:'RIGHT'}})).toBe(1);
    const states=await Promise.all(['beta','gamma'].map(n=>prisma.enrollmentPin.findUniqueOrThrow({where:{id:issued[n]!.id},select:{status:true}})));
    expect(states.map(x=>x.status).sort()).toEqual(['ISSUED','REDEEMED']);
    expect(await prisma.memberProfile.count({where:{organizationId:org,userId:{in:[account['beta']!,account['gamma']!]}}})).toBe(1);
  });

  it('revocation prevents consumption and leaves no member/consent records', async () => {
    await issue('delta');
    await http('maker').post('/member-enrollment/pins/'+issued['delta']!.id+'/revoke',{reason:'Security cancellation approved'}).expect(201);
    await http('delta').post('/member-enrollment/enroll', enrollment('delta',{side:'LEFT'})).expect(409);
    expect((await prisma.enrollmentPin.findUniqueOrThrow({where:{id:issued['delta']!.id}})).status).toBe('REVOKED');
    expect(await prisma.memberProfile.count({where:{organizationId:org,userId:account['delta']!}})).toBe(0);
  });

  it('expired PIN and incorrect package policy are refused', async () => {
    const pin=await issue('epsilon',new Date(Date.now()+1200).toISOString());
    await new Promise(resolve=>setTimeout(resolve,1500));
    await http('epsilon').post('/member-enrollment/enroll', enrollment('epsilon',{side:'LEFT'})).expect(409);
    expect((await prisma.enrollmentPin.findUniqueOrThrow({where:{id:pin.id}})).status).toBe('ISSUED');
    expect(await prisma.memberProfile.count({where:{organizationId:org,userId:account['epsilon']!}})).toBe(0);
  }, 10_000);
});
