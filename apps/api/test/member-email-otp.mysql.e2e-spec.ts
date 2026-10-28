import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret, generateBase32Secret } from '../src/auth/mfa.crypto';

const suite = process.env.RUN_MYSQL_MEMBERS_E2E === '1' ? describe : describe.skip;
const keys = [
  'ADFLICK_SMTP_ENABLED','ADFLICK_SMTP_HOST','ADFLICK_SMTP_PORT','ADFLICK_SMTP_SECURE',
  'ADFLICK_SMTP_FROM_EMAIL','ADFLICK_SMTP_FROM_NAME','ADFLICK_SMTP_INSECURE_LOOPBACK_TEST',
  'ADFLICK_SMTP_USERNAME','ADFLICK_SMTP_PASSWORD','ADFLICK_MEMBER_EMAIL_OTP_ENABLED',
  'ADFLICK_MEMBER_OTP_POLICY_ENABLED','ADFLICK_MEMBER_OTP_HASH_PEPPER','ADFLICK_MEMBER_OTP_HOURLY_CAP',
] as const;

suite('SRS email OTP: SMTP acceptance + MySQL verification lifecycle', () => {
  let app: INestApplication;
  let db: PrismaService;
  let server: Server;
  const original = Object.fromEntries(keys.map(k => [k,process.env[k]]));
  const messages: string[] = [];
  const orgIds: string[] = [];
  const users: string[] = [];
  let org = '', other = '', memberId = '';
  const token: Record<string,string> = {};

  // Local SMTP server is allowed ONLY in isolated test environment.
  // Production mailer rejects plaintext SMTP and always requires TLS.
  async function startSmtp() {
    server = createServer(socket => {
      socket.setEncoding('utf8');
      socket.write('220 local.test ESMTP ready\r\n');
      let input = '', data: string[] = [], reading = false;
      socket.on('data', chunk => {
        input += chunk;
        let end = input.indexOf('\n');
        while (end >= 0) {
          const line = input.slice(0,end).replace(/\r$/, '');
          input = input.slice(end+1);
          if (reading) {
            if (line === '.') {
              messages.push(data.join('\n')); data = []; reading = false;
              socket.write('250 2.0.0 accepted\r\n');
            } else data.push(line.startsWith('..') ? line.slice(1) : line);
          } else if (/^(EHLO|HELO) /i.test(line)) {
            socket.write('250-local.test\r\n250 SIZE 1024000\r\n');
          } else if (/^DATA$/i.test(line)) {
            reading = true; socket.write('354 End data with <CRLF>.<CRLF>\r\n');
          } else if (/^QUIT$/i.test(line)) {
            socket.write('221 Goodbye\r\n'); socket.end();
          } else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)/i.test(line)) {
            socket.write('250 OK\r\n');
          } else socket.write('500 Invalid test SMTP command\r\n');
          end = input.indexOf('\n');
        }
      });
    });
    await new Promise<void>((resolve,reject) => {
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    return (server.address() as AddressInfo).port;
  }

  const api = (name: string) => ({
    get: (path: string) => request(app.getHttpServer()).get('/api/v1/member-enrollment/otp'+path).set('Authorization','Bearer '+token[name]),
    post: (path: string,body:object={}) => request(app.getHttpServer()).post('/api/v1/member-enrollment/otp'+path).set('Authorization','Bearer '+token[name]).send(body),
    put: (path: string,body:object) => request(app.getHttpServer()).put('/api/v1/member-enrollment/otp'+path).set('Authorization','Bearer '+token[name]).send(body),
  });

  async function makeUser(organizationId:string, role:UserRole,name:string,jwt:JwtService) {
    const user = await db.user.create({
      data: {
        organizationId, email:'smtp-'+name+'-'+randomBytes(5).toString('hex')+'@example.test',
        displayName:'Private Test Account', status:'ACTIVE',
        roleAssignments:{create:[{role}]},
      }, select:{id:true,email:true},
    });
    users.push(user.id);
    const session=await db.refreshSession.create({data:{
      userId:user.id,tokenHash:createHash('sha256').update(randomBytes(24)).digest('hex'),
      expiresAt:new Date(Date.now()+20*60_000),
      mfaVerifiedAt:(role===UserRole.ORGANIZATION_ADMIN||role===UserRole.SUPER_ADMIN)?new Date():null,
    }});
    if(role===UserRole.ORGANIZATION_ADMIN||role===UserRole.SUPER_ADMIN) {
      await db.mfaEnrollment.create({data:{
        userId:user.id,secretCiphertext:encryptSecret(generateBase32Secret()),enabled:true,
      }});
    }
    token[name]=await jwt.signAsync({
      sub:user.id,sid:session.id,email:user.email,organizationId,roles:[role],typ:'access',
    });
    return user.id;
  }

  beforeAll(async()=>{
    const raw=process.env.DATABASE_URL;
    if(process.env.NODE_ENV==='production'||!raw||!raw.startsWith('mysql://')||
      !['127.0.0.1','localhost','::1','mysql84','mysql'].includes(new URL(raw).hostname)) {
      throw new Error('Refusing SMTP OTP E2E against a non-disposable MySQL database.');
    }
    const port=await startSmtp();
    Object.assign(process.env,{
      ADFLICK_SMTP_ENABLED:'true',ADFLICK_SMTP_HOST:'127.0.0.1',ADFLICK_SMTP_PORT:String(port),
      ADFLICK_SMTP_SECURE:'false',ADFLICK_SMTP_FROM_EMAIL:'no-reply@example.test',
      ADFLICK_SMTP_FROM_NAME:'ADFLICK',ADFLICK_SMTP_INSECURE_LOOPBACK_TEST:'true',
      ADFLICK_MEMBER_EMAIL_OTP_ENABLED:'false',ADFLICK_MEMBER_OTP_POLICY_ENABLED:'false',
      ADFLICK_MEMBER_OTP_HASH_PEPPER:randomBytes(48).toString('hex'),
    });
    delete process.env.ADFLICK_SMTP_USERNAME;
    delete process.env.ADFLICK_SMTP_PASSWORD;
    const m=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=m.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init();
    db=app.get(PrismaService);
    const jwt=new JwtService({secret:process.env.JWT_ACCESS_SECRET,signOptions:{algorithm:'HS256',expiresIn:'5m'}});
    const suffix=randomBytes(7).toString('hex');
    const a=await db.organization.create({data:{name:'SMTP OTP Test',slug:'smtp-test-'+suffix}});
    const b=await db.organization.create({data:{name:'Other OTP Test',slug:'smtp-foreign-'+suffix}});
    org=a.id;other=b.id;orgIds.push(org,other);
    await makeUser(org,UserRole.ORGANIZATION_ADMIN,'admin',jwt);
    memberId=await makeUser(org,UserRole.MEMBER,'member',jwt);
    await makeUser(other,UserRole.MEMBER,'outsider',jwt);
  },60_000);

  afterAll(async()=>{
    try {
      if(db&&orgIds.length) {
        await db.memberEmailOtp.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.memberEmailOtpThrottle.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.memberOtpPolicy.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.user.deleteMany({where:{id:{in:users}}});
        await db.organization.deleteMany({where:{id:{in:orgIds}}});
      }
    }finally{
      if(app)await app.close();
      if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
      for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
    }
  },60_000);

  it('does not send when feature/master policy disabled and requires member role',async()=>{
    await request(app.getHttpServer()).post('/api/v1/member-enrollment/otp/request').send({}).expect(401);
    await api('admin').post('/request').expect(403);
    await api('member').post('/request').expect(503);
    const initial=await api('admin').get('/policy').expect(200);
    expect(initial.body).toMatchObject({emailEnabled:false,version:0,smtpReady:true,smsEnabled:false});
    await api('admin').put('/policy',{emailEnabled:true,digits:6,ttlSeconds:300,resendSeconds:60,maxAttempts:5,expectedVersion:0}).expect(503);
    expect(messages).toHaveLength(0);
  });

  it('enforces validated admin OTP configuration, optimistic version and scoped audit',async()=>{
    process.env.ADFLICK_MEMBER_OTP_POLICY_ENABLED='true';
    const payload={emailEnabled:true,digits:6,ttlSeconds:300,resendSeconds:60,maxAttempts:5,expectedVersion:0};
    await api('admin').put('/policy',{...payload,digits:3}).expect(400);
    await api('member').put('/policy',payload).expect(403);
    await api('admin').put('/policy',payload).expect(200);
    await api('admin').put('/policy',payload).expect(409);
    const p=await api('admin').get('/policy').expect(200);
    expect(p.body).toMatchObject({emailEnabled:true,digits:6,version:1,smsEnabled:false});
    expect(await db.auditEvent.count({where:{organizationId:org,action:'MEMBER_OTP_POLICY_UPDATED'}})).toBe(1);
  });

  it('sends actual SMTP message, verifies bounded OTP and protects member confidentiality',async()=>{
    process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED='true';
    const sent=await api('member').post('/request').expect(201);
    expect(sent.body.challengeId).toMatch(/^otp_[0-9a-f]{24}$/);
    expect(sent.body).not.toHaveProperty('code');
    expect(messages).toHaveLength(1);
    const received=messages[0]!;
    const matches=received.match(/verification code is (\d{6})/);
    expect(matches?.[1]).toMatch(/^\d{6}$/);
    const secret=matches![1];
    const actual=await db.memberEmailOtp.findUniqueOrThrow({where:{id:sent.body.challengeId}});
    expect(actual.status).toBe('SENT');
    expect(actual.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(actual.codeHash).not.toBe(secret);
    await api('outsider').post('/verify',{challengeId:sent.body.challengeId,code:secret}).expect(400);
    await api('member').post('/request').expect(429);
    await api('member').post('/verify',{challengeId:sent.body.challengeId,code:'000000'===secret?'111111':'000000'}).expect(400);
    expect((await db.memberEmailOtp.findUniqueOrThrow({where:{id:sent.body.challengeId}})).attempts).toBe(1);
    await api('member').post('/verify',{challengeId:sent.body.challengeId,code:secret}).expect(201);
    await api('member').post('/verify',{challengeId:sent.body.challengeId,code:secret}).expect(400);
    const status=await api('member').get('/status').expect(200);
    expect(status.body.verified).toBe(true);
    expect(await db.auditEvent.count({where:{organizationId:org,action:'MEMBER_EMAIL_OTP_VERIFIED'}})).toBe(1);
  });

  it('invalidates old verified OTP on resend and rejects wrong code until max attempts',async()=>{
    await db.memberEmailOtpThrottle.updateMany({where:{organizationId:org,userId:memberId},data:{
      nextAllowedAt:new Date(Date.now()-1000),
    }});
    const old=await db.memberEmailOtp.findFirstOrThrow({where:{organizationId:org,userId:memberId,status:'VERIFIED'}});
    const sent=await api('member').post('/request').expect(201);
    expect((await db.memberEmailOtp.findUniqueOrThrow({where:{id:old.id}})).status).toBe('FAILED');
    for(let i=0;i<5;i++){
      await api('member').post('/verify',{challengeId:sent.body.challengeId,code:'999999'}).expect(400);
    }
    const row=await db.memberEmailOtp.findUniqueOrThrow({where:{id:sent.body.challengeId}});
    expect(row.attempts).toBe(5);
    expect(row.status).toBe('FAILED');
    expect((await api('member').get('/status').expect(200)).body.verified).toBe(false);
  });

  it('SMTP failures do not mark OTP delivered or expose server diagnostics',async()=>{
    await db.memberEmailOtpThrottle.updateMany({where:{organizationId:org,userId:memberId},data:{nextAllowedAt:new Date(Date.now()-1000)}});
    process.env.ADFLICK_SMTP_PORT='1';
    const fail=await api('member').post('/request').expect(503);
    expect(JSON.stringify(fail.body)).not.toContain('ECONNREFUSED');
    const latest=await db.memberEmailOtp.findFirstOrThrow({where:{organizationId:org,userId:memberId},orderBy:{createdAt:'desc'}});
    expect(latest.status).toBe('FAILED');
    expect(latest.sentAt).toBeNull();
  });
  it('expired email challenge cannot be verified even with the correct SMTP-delivered code',async()=>{
    await db.memberEmailOtpThrottle.updateMany({
      where:{organizationId:org,userId:memberId},
      data:{nextAllowedAt:new Date(Date.now()-1000)},
    });
    process.env.ADFLICK_SMTP_PORT=String((server.address() as AddressInfo).port);
    const sent=await api('member').post('/request').expect(201);
    const code=messages[messages.length-1]!.match(/verification code is (\\d{6})/)?.[1];
    expect(code).toMatch(/^\\d{6}$/);
    await db.memberEmailOtp.update({
      where:{id:sent.body.challengeId},
      data:{expiresAt:new Date(Date.now()-1000)},
    });
    const audits=await db.auditEvent.count({where:{organizationId:org,action:'MEMBER_EMAIL_OTP_VERIFIED'}});
    await api('member').post('/verify',{challengeId:sent.body.challengeId,code}).expect(400);
    const challenge=await db.memberEmailOtp.findUniqueOrThrow({where:{id:sent.body.challengeId}});
    expect(challenge.status).toBe('SENT');
    expect(challenge.attempts).toBe(0);
    expect((await api('member').get('/status').expect(200)).body.verified).toBe(false);
    expect(await db.auditEvent.count({where:{organizationId:org,action:'MEMBER_EMAIL_OTP_VERIFIED'}})).toBe(audits);
  });

});
