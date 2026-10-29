import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret, generateBase32Secret } from '../src/auth/mfa.crypto';

const suite = process.env.RUN_MYSQL_OPERATIONS_E2E === '1' ? describe : describe.skip;

suite('Real CMS, campaign and fleet REST integration — disposable MySQL', () => {
  let app:INestApplication, prisma:PrismaService;
  let org='', otherOrg='', asset='', otherAsset='', token='', otherToken='', screen='';
  const suffix=randomBytes(6).toString('hex');
  const get=(path:string,who=token)=>request(app.getHttpServer()).get('/api/v1'+path).set('Authorization','Bearer '+who);
  const post=(path:string,data:object,who=token)=>request(app.getHttpServer()).post('/api/v1'+path).set('Authorization','Bearer '+who).send(data);
  async function admin(organizationId:string,label:string) {
    const user=await prisma.user.create({data:{
      organizationId,email:'real-ops-'+label+'-'+suffix+'@example.test',
      displayName:'Isolated Operations QA',status:'ACTIVE',
      roleAssignments:{create:[{role:UserRole.ORGANIZATION_ADMIN}]},
    }});
    const session=await prisma.refreshSession.create({data:{
      userId:user.id,tokenHash:createHash('sha256').update(randomBytes(32)).digest('hex'),
      expiresAt:new Date(Date.now()+60*60_000),mfaVerifiedAt:new Date(),
    }});
    await prisma.mfaEnrollment.create({data:{
      userId:user.id,secretCiphertext:encryptSecret(generateBase32Secret()),enabled:true,
    }});
    const jwt=new JwtService({secret:process.env.JWT_ACCESS_SECRET,signOptions:{algorithm:'HS256',expiresIn:'5m'}});
    return jwt.signAsync({
      sub:user.id,sid:session.id,email:user.email,organizationId,roles:[UserRole.ORGANIZATION_ADMIN],typ:'access',
    });
  }

  beforeAll(async()=>{
    const db=process.env.DATABASE_URL;
    if(process.env.NODE_ENV==='production'||!db?.startsWith('mysql://')||
       !['localhost','127.0.0.1','::1','mysql84','mysql'].includes(new URL(db).hostname)||
       !process.env.JWT_ACCESS_SECRET||process.env.JWT_ACCESS_SECRET.length<32) {
      throw new Error('Real operations acceptance requires disposable non-production MySQL.');
    }
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init();prisma=app.get(PrismaService);
    const first=await prisma.organization.create({data:{name:'Real Ops Fixture',slug:'real-ops-'+suffix}});
    const second=await prisma.organization.create({data:{name:'Foreign Ops Fixture',slug:'foreign-ops-'+suffix}});
    org=first.id;otherOrg=second.id;
    token=await admin(org,'owner');otherToken=await admin(otherOrg,'foreign');
    const trusted=await prisma.mediaAsset.create({data:{
      organizationId:org,title:'QA Trusted Creative',originalName:'verified.png',
      mimeType:'image/png',sizeBytes:BigInt(2048),status:'READY',
      storageKey:org+'/test-only/trusted.png',
    }});
    const foreign=await prisma.mediaAsset.create({data:{
      organizationId:otherOrg,title:'Foreign Fixture',originalName:'foreign.png',
      mimeType:'image/png',sizeBytes:BigInt(4096),status:'READY',
      storageKey:otherOrg+'/test-only/foreign.png',
    }});
    asset=trusted.id;otherAsset=foreign.id;
  },60_000);

  afterAll(async()=>{
    try{
      if(prisma&&org&&otherOrg){
        const orgs=[org,otherOrg];
        await prisma.campaign.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.playlist.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.screenLayout.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.devicePairingCode.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.screen.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.mediaAsset.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.auditEvent.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.user.deleteMany({where:{organizationId:{in:orgs}}});
        await prisma.organization.deleteMany({where:{id:{in:orgs}}});
      }
    }finally{if(app)await app.close();}
  },60_000);

  it('real asset inventory uses tenant scope and denies missing JWT',async()=>{
    await request(app.getHttpServer()).get('/api/v1/cms/assets').expect(401);
    await request(app.getHttpServer()).get('/api/v1/campaigns').expect(401);
    await request(app.getHttpServer()).get('/api/v1/fleet/screens').expect(401);
    const own=await get('/cms/assets').expect(200);
    expect(own.body).toEqual(expect.arrayContaining([expect.objectContaining({id:asset,status:'READY',sizeBytes:'2048'})]));
    expect(JSON.stringify(own.body)).not.toContain(otherAsset);
    const foreign=await get('/cms/assets',otherToken).expect(200);
    expect(JSON.stringify(foreign.body)).not.toContain(asset);
    expect(foreign.body).toEqual(expect.arrayContaining([expect.objectContaining({id:otherAsset})]));
  });

  it('persists layout DRAFT and playlist DRAFT; rejects cross-tenant media references',async()=>{
    const layout=await post('/cms/layouts',{name:'Real QA Layout',canvasWidth:1920,canvasHeight:1080,
      zones:[{id:'main',name:'Main',x:0,y:0,width:1280,height:1080,type:'Video'}],
    }).expect(201);
    expect(layout.body).toMatchObject({status:'DRAFT',name:'Real QA Layout'});
    const layouts=await get('/cms/layouts').expect(200);
    expect(layouts.body.some((item:{id:string})=>item.id===layout.body.id)).toBe(true);

    await post('/cms/playlists',{name:'Foreign forbidden',items:[{assetId:otherAsset,durationMs:15000}]}).expect(400);
    const created=await post('/cms/playlists',{name:'Real QA Playlist',items:[{assetId:asset,durationMs:15000}]}).expect(201);
    expect(created.body).toMatchObject({status:'DRAFT',name:'Real QA Playlist'});
    const playlists=await get('/cms/playlists').expect(200);
    expect(playlists.body.some((item:{id:string})=>item.id===created.body.id)).toBe(true);
    expect(JSON.stringify(await get('/cms/playlists',otherToken).expect(200).then(res=>res.body))).not.toContain(created.body.id);
  });

  it('creates and submits a real READY-asset campaign with JSON-safe exact paise, no activation',async()=>{
    await post('/campaigns',{name:'Foreign media prohibited',creativeAssetIds:[otherAsset]}).expect(400);
    const created=await post('/campaigns',{name:'Real QA Draft',creativeAssetIds:[asset],
      budgetPaise:987654321,currency:'INR',
    }).expect(201);
    expect(created.body).toMatchObject({status:'DRAFT',budgetPaise:'987654321',currency:'INR'});
    const id=created.body.id;
    expect((await get('/campaigns/'+id).expect(200)).body).toMatchObject({id,budgetPaise:'987654321'});
    const list=await get('/campaigns').expect(200);
    expect(list.body.some((item:{id:string;budgetPaise:string})=>item.id===id&&item.budgetPaise==='987654321')).toBe(true);
    expect(JSON.stringify((await get('/campaigns',otherToken).expect(200)).body)).not.toContain(id);
    await get('/campaigns/'+id,otherToken).expect(404);
    const submitted=await post('/campaigns/'+id+'/submit',{}).expect(201);
    expect(submitted.body).toMatchObject({status:'PENDING_REVIEW',budgetPaise:'987654321'});
    await post('/campaigns/'+id+'/schedule',{}).expect(400);
    expect((await prisma.campaign.findUniqueOrThrow({where:{id}})).status).toBe('PENDING_REVIEW');
    expect(await prisma.rewardLedgerEntry.count({where:{organizationId:org}})).toBe(0);
  });

  it('registers a pending screen, hashes one-time code, and isolates fleet reads',async()=>{
    const created=await post('/fleet/screens',{name:'Fixture Front Display',platform:'Android TV'}).expect(201);
    expect(created.body.screen).toMatchObject({name:'Fixture Front Display',status:'PENDING_PAIRING'});
    expect(created.body.pairingCode).toMatch(/^[A-F0-9]{12}$/);
    screen=created.body.screen.id;
    const pair=await prisma.devicePairingCode.findFirstOrThrow({where:{screenId:screen}});
    expect(pair.codeHash).not.toBe(created.body.pairingCode);
    expect(pair.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const rows=await get('/fleet/screens').expect(200);
    expect(rows.body.some((item:{id:string})=>item.id===screen)).toBe(true);
    expect(JSON.stringify(rows.body)).not.toContain(created.body.pairingCode);
    expect(JSON.stringify((await get('/fleet/screens',otherToken).expect(200)).body)).not.toContain(screen);
    const health=await get('/fleet/health-summary').expect(200);
    expect(health.body.screens.total).toBe(1);
  });
});
