import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { AddressInfo } from 'node:net';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret, generateBase32Secret } from '../src/auth/mfa.crypto';

const suite = process.env.RUN_MYSQL_MEMBERS_E2E === '1' ? describe : describe.skip;
const keys = [
  'ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED','ADFLICK_PUBLIC_SIGNUP_ENABLED','ADFLICK_PUBLIC_SIGNUP_HMAC_SECRET',
  'ADFLICK_MEMBER_EMAIL_OTP_ENABLED','ADFLICK_SMTP_ENABLED','ADFLICK_SMTP_HOST','ADFLICK_SMTP_PORT',
  'ADFLICK_SMTP_SECURE','ADFLICK_SMTP_FROM_EMAIL','ADFLICK_SMTP_FROM_NAME','ADFLICK_SMTP_USERNAME',
  'ADFLICK_SMTP_PASSWORD','ADFLICK_SMTP_INSECURE_LOOPBACK_TEST',
] as const;

suite('SRS public verified-email account bootstrap — real MySQL + SMTP HTTP',()=>{
  let app:INestApplication, db:PrismaService, server:Server, orgId='', slug='', documentId='', hash='', version='';
  let adminId='', adminToken='', verifiedUserId='';
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const messages:string[]=[];
  const pending:string[]=[];
  const names:string[]=[];
  const password='ADFLICK-Test-Strong-Password-2026!';
  const post=(url:string,data:object)=>request(app.getHttpServer()).post('/api/v1'+url).send(data);
  const dto=(name:string)=>({
    organizationSlug:slug, email:name+'@example.test', displayName:'Verified Member Applicant',
    password, consentVersion:version, consentDocumentSha256:hash, consentAccepted:true,
  });
  async function startSmtp() {
    server=createServer(socket=>{
      socket.setEncoding('utf8'); socket.write('220 test.local ESMTP ready\r\n');
      let buffer='',reading=false,lines:string[]=[];
      socket.on('data',chunk=>{
        buffer+=chunk;
        let k=buffer.indexOf('\n');
        while(k>=0){
          const line=buffer.slice(0,k).replace(/\r$/,'');buffer=buffer.slice(k+1);
          if(reading){
            if(line==='.'){messages.push(lines.join('\n'));lines=[];reading=false;socket.write('250 accepted\r\n');}
            else lines.push(line.startsWith('..')?line.slice(1):line);
          }else if(/^(EHLO|HELO) /i.test(line))socket.write('250-test.local\r\n250 SIZE 1024000\r\n');
          else if(/^DATA$/i.test(line)){reading=true;socket.write('354 send data\r\n');}
          else if(/^QUIT$/i.test(line)){socket.write('221 bye\r\n');socket.end();}
          else if(/^(MAIL FROM|RCPT TO|RSET|NOOP)/i.test(line))socket.write('250 ok\r\n');
          else socket.write('500 invalid\r\n');
          k=buffer.indexOf('\n');
        }
      });
    });
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    return (server.address() as AddressInfo).port;
  }

  beforeAll(async()=>{
    const url=process.env.DATABASE_URL;
    if(process.env.NODE_ENV==='production'||!url||!url.startsWith('mysql://')||
       !['localhost','127.0.0.1','::1','mysql84','mysql'].includes(new URL(url).hostname)||
       !process.env.JWT_ACCESS_SECRET||process.env.JWT_ACCESS_SECRET.length<32)
      throw new Error('Public signup acceptance requires disposable MySQL and non-production JWT.');
    const port=await startSmtp();
    Object.assign(process.env,{
      ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED:'false',ADFLICK_PUBLIC_SIGNUP_ENABLED:'false',
      ADFLICK_MEMBER_EMAIL_OTP_ENABLED:'true',
      ADFLICK_PUBLIC_SIGNUP_HMAC_SECRET:randomBytes(48).toString('hex'),
      ADFLICK_SMTP_ENABLED:'true',ADFLICK_SMTP_HOST:'127.0.0.1',ADFLICK_SMTP_PORT:String(port),
      ADFLICK_SMTP_SECURE:'false',ADFLICK_SMTP_FROM_EMAIL:'no-reply@example.test',
      ADFLICK_SMTP_FROM_NAME:'ADFLICK',ADFLICK_SMTP_INSECURE_LOOPBACK_TEST:'true',
    });
    delete process.env.ADFLICK_SMTP_USERNAME;delete process.env.ADFLICK_SMTP_PASSWORD;
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init();db=app.get(PrismaService);
    const suffix=randomBytes(7).toString('hex');
    slug='public-signup-'+suffix;
    const org=await db.organization.create({data:{name:'Public Registration Test Org',slug}});
    orgId=org.id;
    const admin=await db.user.create({data:{
      email:'signup-admin-'+suffix+'@example.test',displayName:'Signup Review Admin',organizationId:orgId,status:'ACTIVE',
      roleAssignments:{create:[{role:UserRole.ORGANIZATION_ADMIN}]},
    },select:{id:true,email:true}});
    adminId=admin.id;
    const session=await db.refreshSession.create({data:{
      userId:adminId,tokenHash:createHash('sha256').update(randomBytes(24)).digest('hex'),
      expiresAt:new Date(Date.now()+20*60_000),mfaVerifiedAt:new Date(),
    }});
    await db.mfaEnrollment.create({data:{
      userId:adminId,secretCiphertext:encryptSecret(generateBase32Secret()),enabled:true,
    }});
    const jwt=new JwtService({secret:process.env.JWT_ACCESS_SECRET,signOptions:{algorithm:'HS256',expiresIn:'5m'}});
    adminToken=await jwt.signAsync({
      sub:adminId,sid:session.id,email:admin.email,organizationId:orgId,roles:[UserRole.ORGANIZATION_ADMIN],typ:'access',
    });
    await db.memberOtpPolicy.create({data:{organizationId:orgId,emailEnabled:true,updatedByUserId:adminId}});
    version='test-legal-'+suffix;
    const doc='Isolated acceptance test legal document. This is not approved client copy and is never published to production.';
    hash=createHash('sha256').update(doc).digest('hex');
    const consent=await db.memberConsentDocument.create({data:{
      organizationId:orgId,version,documentSha256:hash,documentText:doc,status:'APPROVED',
      createdByUserId:adminId,approvedByUserId:adminId,approvedAt:new Date(),
    }});
    documentId=consent.id;
  },60_000);

  afterAll(async()=>{
    try{
      if(db&&orgId){
        await db.publicSignupIntent.deleteMany({where:{organizationId:orgId}});
        await db.publicSignupThrottle.deleteMany({where:{organizationId:orgId}});
        await db.publicSignupPolicy.deleteMany({where:{organizationId:orgId}});
        await db.accountConsentRecord.deleteMany({where:{organizationId:orgId}});
        await db.memberOtpPolicy.deleteMany({where:{organizationId:orgId}});
        await db.memberConsentDocument.deleteMany({where:{organizationId:orgId}});
        await db.user.deleteMany({where:{organizationId:orgId}});
        await db.organization.deleteMany({where:{id:orgId}});
      }
    }finally{
      if(app)await app.close();
      if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
      for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
    }
  },60_000);

  it('is closed by default; privileged policy needs JWT, MFA and operator switch',async()=>{
    await request(app.getHttpServer()).get('/api/v1/public-signup/organizations/'+slug).expect(503);
    await post('/public-signup/start',dto('one')).expect(503);
    await request(app.getHttpServer()).put('/api/v1/admin/public-signup/policy').send({enabled:true,expectedVersion:0}).expect(401);
    await request(app.getHttpServer()).put('/api/v1/admin/public-signup/policy')
      .set('Authorization','Bearer '+adminToken).send({enabled:true,expectedVersion:0}).expect(503);
    expect(messages).toHaveLength(0);
  });

  it('audits tenant-specific policy; publishes ONLY approved legal copy when enabled',async()=>{
    process.env.ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED='true';
    const update=()=>request(app.getHttpServer()).put('/api/v1/admin/public-signup/policy')
      .set('Authorization','Bearer '+adminToken).send({enabled:true,expectedVersion:0});
    await update().expect(200);
    await update().expect(409);
    process.env.ADFLICK_PUBLIC_SIGNUP_ENABLED='true';
    const org=await request(app.getHttpServer()).get('/api/v1/public-signup/organizations/'+slug).expect(200);
    expect(org.body).toMatchObject({organizationSlug:slug,organizationName:'Public Registration Test Org',
      consentVersion:version,consentDocumentSha256:hash,mobileOtpVerified:false,memberActivated:false});
    expect(org.body.consentText).toContain('Isolated acceptance');
    await request(app.getHttpServer()).get('/api/v1/public-signup/organizations/nonexistent-tenant').expect(404);
    expect(await db.auditEvent.count({where:{organizationId:orgId,action:'PUBLIC_SIGNUP_POLICY_CHANGED'}})).toBe(1);
  });

  it('validates current consent and sends real SMTP OTP; never returns token or password',async()=>{
    await post('/public-signup/start',{...dto('one'),consentDocumentSha256:'a'.repeat(64)}).expect(400);
    await post('/public-signup/start',{...dto('one'),password:'short'}).expect(400);
    const response=await post('/public-signup/start',dto('one')).expect(201);
    pending.push(response.body.requestId);
    names.push('one@example.test');
    expect(response.body.requestId).toMatch(/^ps_[a-f0-9]{24}$/);
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(JSON.stringify(response.body)).not.toContain('verification code is');
    expect(messages).toHaveLength(1);
    const row=await db.publicSignupIntent.findUniqueOrThrow({where:{id:response.body.requestId}});
    expect(row.status).toBe('SENT');
    expect(row.passwordHash).not.toBe(password);
    expect(await argon2.verify(row.passwordHash,password)).toBe(true);
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects wrong OTP and creates only a verified account with immutable consent and REAL login',async()=>{
    const reqId=pending[0]!;
    const code=messages[0]!.match(/verification code is (\d{6})/)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    await post('/public-signup/verify',{requestId:reqId,code:code==='000000'?'111111':'000000'}).expect(400);
    const correct=await post('/public-signup/verify',{requestId:reqId,code}).expect(201);
    expect(correct.body).toMatchObject({emailVerified:true,memberActivated:false,profileCreated:false});
    const account=await db.user.findUniqueOrThrow({where:{email:'one@example.test'},include:{accountConsent:true,roleAssignments:true}});
    verifiedUserId=account.id;
    expect(account.roleAssignments.map(x=>x.role)).toContain('MEMBER');
    expect(account.accountConsent?.documentId).toBe(documentId);
    expect(await db.memberProfile.count({where:{organizationId:orgId,userId:account.id}})).toBe(0);
    expect(await db.publicSignupIntent.count({where:{organizationId:orgId,email:'one@example.test'}})).toBe(0);
    await post('/public-signup/verify',{requestId:reqId,code}).expect(400);
    await post('/auth/login',{email:'one@example.test',password}).expect(201)
      .then(r=>{expect(r.body.user.roles).toContain('MEMBER');expect(r.headers['set-cookie']).toBeDefined();});
  });

  it('does not enumerate existing emails; denies repeated request and cross-tenant impersonation',async()=>{
    const count=messages.length;
    // Time-based cooldown is MySQL-authoritative; move only this isolated test
    // fixture into a later window to compare known and unknown account behavior.
    await db.publicSignupThrottle.updateMany({where:{organizationId:orgId},data:{
      nextAllowedAt:new Date(Date.now()-1000),
    }});
    const existing=await post('/public-signup/start',dto('one')).expect(201);
    expect(existing.body.requestId).toMatch(/^ps_[a-f0-9]{24}$/);
    expect(messages).toHaveLength(count);
    await post('/public-signup/verify',{requestId:existing.body.requestId,code:'000000'}).expect(400);
    const a=await post('/public-signup/start',dto('two')).expect(201);
    const second=await post('/public-signup/start',dto('two')).expect(429);
    expect(second.body.message).toBeDefined();
    expect(a.body.requestId).toMatch(/^ps_[a-f0-9]{24}$/);
  });

  it('limits invalid OTP attempts and never creates a member/account on lockout',async()=>{
    const latest=await db.publicSignupIntent.findFirstOrThrow({where:{organizationId:orgId,email:'two@example.test'},orderBy:{createdAt:'desc'}});
    for(let n=0;n<5;n++){
      await post('/public-signup/verify',{requestId:latest.id,code:'999999'}).expect(400);
    }
    const blocked=await db.publicSignupIntent.findUniqueOrThrow({where:{id:latest.id}});
    expect(blocked.status).toBe('FAILED');
    expect(blocked.attempts).toBe(5);
    expect(await db.user.count({where:{email:'two@example.test'}})).toBe(0);
    expect(await db.memberProfile.count({where:{organizationId:orgId,userId:verifiedUserId}})).toBe(0);
  });
  it('expired public email proof never creates credentials, member profile or consent records',async()=>{
    const priorMessages=messages.length;
    const attempt=await post('/public-signup/start',dto('expired')).expect(201);
    expect(messages).toHaveLength(priorMessages+1);
    const code=messages[messages.length-1]!.match(/verification code is ([0-9]{6})/)?.[1];
    expect(code).toMatch(/^[0-9]{6}$/);
    await db.publicSignupIntent.update({
      where:{id:attempt.body.requestId},
      data:{expiresAt:new Date(Date.now()-1000)},
    });
    const before=await db.auditEvent.count({where:{organizationId:orgId,action:'PUBLIC_SIGNUP_EMAIL_VERIFIED_ACCOUNT_CREATED'}});
    await post('/public-signup/verify',{requestId:attempt.body.requestId,code}).expect(400);
    const persisted=await db.publicSignupIntent.findUniqueOrThrow({where:{id:attempt.body.requestId}});
    expect(persisted.status).toBe('SENT');
    expect(persisted.attempts).toBe(0);
    expect(await db.user.count({where:{organizationId:orgId,email:'expired@example.test'}})).toBe(0);
    expect(await db.memberProfile.count({where:{organizationId:orgId}})).toBe(0);
    expect(await db.accountConsentRecord.count({where:{organizationId:orgId}})).toBe(1);
    expect(await db.auditEvent.count({where:{organizationId:orgId,action:'PUBLIC_SIGNUP_EMAIL_VERIFIED_ACCOUNT_CREATED'}})).toBe(before);
  });

});
