import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { smsConfiguration } from '../src/enrollment/sms-gateway.service';

const suite=process.env.RUN_MYSQL_MEMBERS_E2E==='1'?describe:describe.skip;
const keys=[
  'ADFLICK_SMS_ENABLED','ADFLICK_SMS_PROVIDER_APPROVED','ADFLICK_SMS_GATEWAY_URL',
  'ADFLICK_SMS_GATEWAY_BEARER_TOKEN','ADFLICK_SMS_SENDER_ID','ADFLICK_SMS_OTP_TEMPLATE',
  'ADFLICK_SMS_INSECURE_LOOPBACK_TEST','ADFLICK_MEMBER_PHONE_OTP_ENABLED',
  'ADFLICK_MEMBER_PHONE_OTP_HASH_PEPPER','ADFLICK_MEMBER_PHONE_DATA_KEY',
  'ADFLICK_MEMBER_PHONE_OTP_TTL_SECONDS','ADFLICK_MEMBER_PHONE_OTP_RESEND_SECONDS',
  'ADFLICK_MEMBER_PHONE_OTP_MAX_ATTEMPTS','ADFLICK_MEMBER_PHONE_OTP_HOURLY_CAP',
] as const;

suite('real HTTP JSON SMS gateway + disposable MySQL phone OTP lifecycle',()=>{
  let app:INestApplication,db:PrismaService,srv:Server;
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const orgIds:string[]=[],userIds:string[]=[];
  const received:{to:string;message:string;senderId:string;reference:string}[]=[];
  const tokens:Record<string,string>={};
  let org='',user='',rejectDelivery=false,port=0;
  const get=(actor:string,p:string)=>request(app.getHttpServer()).get('/api/v1/member-enrollment/phone'+p).set('Authorization','Bearer '+tokens[actor]);
  const post=(actor:string,p:string,data:object)=>request(app.getHttpServer()).post('/api/v1/member-enrollment/phone'+p)
    .set('Authorization','Bearer '+tokens[actor]).send(data);

  beforeAll(async()=>{
    const dbUrl=process.env.DATABASE_URL;
    if(process.env.NODE_ENV==='production'||!dbUrl||!dbUrl.startsWith('mysql://')||
       !['localhost','127.0.0.1','::1','mysql84','mysql'].includes(new URL(dbUrl).hostname))
      throw Error('SMS acceptance must only run against disposable local MySQL.');
    srv=createServer(async(req,res)=>{
      if(req.method!=='POST'||req.url!=='/sms'){res.writeHead(404);res.end();return;}
      let body='';
      for await(const chunk of req) body+=String(chunk);
      if(req.headers.authorization!=='Bearer SMS-TEST-'+ 'X'.repeat(32)){res.writeHead(401);res.end();return;}
      const parsed=JSON.parse(body) as {to:string;message:string;senderId:string;reference:string};
      received.push(parsed);
      res.writeHead(rejectDelivery?503:200,{'content-type':'application/json'});
      res.end(JSON.stringify(rejectDelivery?{accepted:false}:{accepted:true,messageId:'provider-'+randomBytes(7).toString('hex')}));
    });
    await new Promise<void>((resolve,reject)=>{srv.once('error',reject);srv.listen(0,'127.0.0.1',resolve);});
    port=(srv.address() as AddressInfo).port;
    Object.assign(process.env,{
      ADFLICK_SMS_ENABLED:'false',ADFLICK_SMS_PROVIDER_APPROVED:'false',
      ADFLICK_SMS_GATEWAY_URL:'http://127.0.0.1:'+port+'/sms',
      ADFLICK_SMS_GATEWAY_BEARER_TOKEN:'SMS-TEST-'+'X'.repeat(32),
      ADFLICK_SMS_SENDER_ID:'ADFLICK',
      ADFLICK_SMS_OTP_TEMPLATE:'ADFLICK membership OTP {code}, expires in {minutes} minutes. Do not share.',
      ADFLICK_SMS_INSECURE_LOOPBACK_TEST:'true',ADFLICK_MEMBER_PHONE_OTP_ENABLED:'false',
      ADFLICK_MEMBER_PHONE_OTP_HASH_PEPPER:randomBytes(48).toString('hex'),
      ADFLICK_MEMBER_PHONE_DATA_KEY:randomBytes(32).toString('base64url'),
      ADFLICK_MEMBER_PHONE_OTP_TTL_SECONDS:'300',ADFLICK_MEMBER_PHONE_OTP_RESEND_SECONDS:'60',
      ADFLICK_MEMBER_PHONE_OTP_MAX_ATTEMPTS:'5',ADFLICK_MEMBER_PHONE_OTP_HOURLY_CAP:'10',
    });
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init();db=app.get(PrismaService);
    const suffix=randomBytes(7).toString('hex');
    const a=await db.organization.create({data:{name:'SMS Real HTTP Test A',slug:'sms-http-a-'+suffix}});
    const b=await db.organization.create({data:{name:'SMS Real HTTP Test B',slug:'sms-http-b-'+suffix}});
    org=a.id;orgIds.push(a.id,b.id);
    const jwt=new JwtService({secret:process.env.JWT_ACCESS_SECRET,signOptions:{algorithm:'HS256',expiresIn:'5m'}});
    for(const [name,organizationId,role] of [
      ['member',a.id,UserRole.MEMBER],['resend',a.id,UserRole.MEMBER],['outsider',b.id,UserRole.MEMBER],
      ['admin',a.id,UserRole.ORGANIZATION_ADMIN],
    ] as const){
      const u=await db.user.create({data:{
        organizationId,email:'sms-'+name+'-'+suffix+'@example.test',displayName:'SMS Test Account',
        status:'ACTIVE',roleAssignments:{create:[{role}]},
      },select:{id:true,email:true}});
      userIds.push(u.id);if(name==='member')user=u.id;
      const session=await db.refreshSession.create({data:{
        userId:u.id,tokenHash:createHash('sha256').update(randomBytes(28)).digest('hex'),
        expiresAt:new Date(Date.now()+20*60_000),
      }});
      tokens[name]=await jwt.signAsync({
        sub:u.id,sid:session.id,email:u.email,organizationId,roles:[role],typ:'access',
      });
    }
  },60_000);

  afterAll(async()=>{
    try{
      if(db&&orgIds.length){
        await db.verifiedMemberPhone.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.memberPhoneOtp.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.memberPhoneOtpThrottle.deleteMany({where:{organizationId:{in:orgIds}}});
        await db.user.deleteMany({where:{id:{in:userIds}}});
        await db.organization.deleteMany({where:{id:{in:orgIds}}});
      }
    }finally{
      if(app)await app.close();
      if(srv)await new Promise<void>(resolve=>srv.close(()=>resolve()));
      for(const key of keys) {
        if(previous[key]===undefined)delete process.env[key];
        else process.env[key]=previous[key];
      }
    }
  },60_000);

  it('is default-deny, rejects role/anonymous access and unsafe non-TLS endpoints',async()=>{
    await request(app.getHttpServer()).post('/api/v1/member-enrollment/phone/request')
      .send({phone:'+919876543210',smsConsentAccepted:true}).expect(401);
    await post('admin','/request',{phone:'+919876543210',smsConsentAccepted:true}).expect(403);
    await post('member','/request',{phone:'+919876543210',smsConsentAccepted:true}).expect(503);
    await get('admin','/configuration').expect(200).then(r=>{
      expect(r.body).toMatchObject({ready:false,enabled:false,providerReady:false});
    });
    expect(()=>smsConfiguration({...process.env,NODE_ENV:'production'})).toThrow();
    expect(received).toHaveLength(0);
  });

  it('requires explicit SMS consent and genuine accepted provider response',async()=>{
    Object.assign(process.env,{
      ADFLICK_SMS_ENABLED:'true',ADFLICK_SMS_PROVIDER_APPROVED:'true',
      ADFLICK_MEMBER_PHONE_OTP_ENABLED:'true',
    });
    await post('member','/request',{phone:'+919876543210',smsConsentAccepted:false}).expect(400);
    await post('member','/request',{phone:'9876543210',smsConsentAccepted:true}).expect(400);
    const response=await post('member','/request',{phone:'+919876543210',smsConsentAccepted:true}).expect(201);
    expect(response.body.challengeId).toMatch(/^ph_[a-f0-9]{24}$/);
    expect(response.body.maskedPhone).toBe('••••3210');
    expect(response.body).not.toHaveProperty('code');
    expect(received).toHaveLength(1);
    expect(received[0]!.to).toBe('+919876543210');
    expect(received[0]!.message).toContain('ADFLICK membership OTP ');
    const row=await db.memberPhoneOtp.findUniqueOrThrow({where:{id:response.body.challengeId}});
    expect(row.status).toBe('SENT');
    expect(row.phoneCiphertext).not.toContain('+919876543210');
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.smsConsentAcceptedAt).toBeInstanceOf(Date);
    await post('member','/request',{phone:'+919876543210',smsConsentAccepted:true}).expect(429);
    await post('outsider','/verify',{challengeId:response.body.challengeId,code:'000000'}).expect(400);
  });

  it('verifies only matching OTP; protects wrong/replayed/cross-tenant codes',async()=>{
    const id=received[0]!.reference;
    const code=received[0]!.message.match(/OTP (\d{6})/)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    await post('member','/verify',{challengeId:id,code:code==='000000'?'111111':'000000'}).expect(400);
    await post('member','/verify',{challengeId:id,code}).expect(201);
    await post('member','/verify',{challengeId:id,code}).expect(400);
    const status=await get('member','/status').expect(200);
    expect(status.body).toMatchObject({verified:true,maskedPhone:'••••3210',channel:'SMS'});
    expect(JSON.stringify(status.body)).not.toContain('+919876543210');
    expect(await db.auditEvent.count({where:{organizationId:org,action:'MEMBER_PHONE_OTP_VERIFIED'}})).toBe(1);
  });

  it('new SMS request invalidates older verified challenge; provider rejection never reports sent',async()=>{
    const firstSend=await post('resend','/request',{phone:'+919876543212',smsConsentAccepted:true}).expect(201);
    const initial=received[received.length-1]!;
    expect(initial.reference).toBe(firstSend.body.challengeId);
    const validCode=initial.message.match(/OTP (\\d{6})/)?.[1];
    await post('resend','/verify',{challengeId:initial.reference,code:validCode}).expect(201);
    const owner=await db.memberPhoneOtp.findUniqueOrThrow({
      where:{id:initial.reference},select:{userId:true},
    });
    await db.memberPhoneOtpThrottle.updateMany({
      where:{organizationId:org,userId:owner.userId},
      data:{nextAllowedAt:new Date(Date.now()-1000)},
    });
    rejectDelivery=true;
    await post('resend','/request',{phone:'+919876543211',smsConsentAccepted:true}).expect(503);
    expect((await db.memberPhoneOtp.findUniqueOrThrow({where:{id:initial.reference}})).status).toBe('FAILED');
    const latest=await db.memberPhoneOtp.findFirstOrThrow({
      where:{organizationId:org,userId:owner.userId},orderBy:{createdAt:'desc'},
    });
    expect(latest.status).toBe('FAILED');
    expect(latest.sentAt).toBeNull();
    expect((await get('resend','/status').expect(200)).body.verified).toBe(false);
  });
});
