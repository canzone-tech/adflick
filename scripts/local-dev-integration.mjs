// CI-only proof that local persistent database survives process and database restart.
// Exercises the real compiled NestJS API with actual Argon2 credentials and session revocation.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { PrismaClient } from '@prisma/client';
import { startPersistentDevMysql, cleanupPersistentDevCI } from './local-dev-db.mjs';
import { createFirstAdmin } from '../prisma/first-admin.mjs';

if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.ADFLICK_LOCAL_DEV_CI !== '1') throw new Error('Local-dev integration probe is CI-only.');
let db, prisma, api;
const password = randomBytes(24).toString('hex');
const email = 'operator+' + randomBytes(5).toString('hex') + '@adflick.example.test';
async function port() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const n = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return n;
}
async function call(base, path, status, body, token) {
  const result = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000)
  });
  const json = await result.json().catch(() => ({}));
  if (result.status !== status) throw new Error(path + ' returned HTTP ' + result.status + ' instead of ' + status);
  return json;
}
async function boot(url, apiPort) {
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test',
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    WEB_ORIGIN: 'http://127.0.0.1:39998', SCHEDULER_ENABLED: 'false',
    ALERT_SCAN_ENABLED: 'false', NOTIFICATION_OUTBOX_ENABLED: 'false',
    API_PORT: String(apiPort), API_HOST: '127.0.0.1' };
  api = spawn(process.execPath, ['apps/api/dist/main.js'], { env, stdio: 'ignore', detached: true });
  const base = 'http://127.0.0.1:' + apiPort + '/api/v1';
  let ready = false;
  for(let i=0;i<100;i++){
    if (api.exitCode!==null) throw new Error('API exited before ready.');
    try { await call(base, '/health', 200); ready = true; break; } catch {}
    await new Promise(r=>setTimeout(r,300));
  }
  if(!ready) throw new Error('Compiled API did not become healthy.');
  return base;
}
async function haltApi() {
  if(!api) return;
  const p=api;
  try { process.kill(-p.pid, 'SIGTERM'); } catch { try { p.kill('SIGTERM'); } catch {} }
  await new Promise(resolve => { if(p.exitCode!==null)resolve();else{p.once('exit',resolve);setTimeout(resolve,4000).unref();} });
  api=null;
}
try {
  db=startPersistentDevMysql();
  process.env.DATABASE_URL=db.url;
  const migrate=spawnSync('node_modules/.bin/prisma',['migrate','deploy'],
    {env:{...process.env,DATABASE_URL:db.url},stdio:'inherit',timeout:120000,shell:false});
  if(migrate.error||migrate.status!==0)throw new Error('Persistent schema migration failed.');
  prisma=new PrismaClient();
  const created=await createFirstAdmin(prisma,{organization:'ADFLICK CI Organization',
    displayName:'CI Operator',email,password});
  if(created.role!=='ORGANIZATION_ADMIN')throw new Error('Bootstrap granted unexpected role.');
  await (async()=>{try{await createFirstAdmin(prisma,{organization:'No',displayName:'No',email,password});throw new Error('Second bootstrap unexpectedly succeeded');}catch(e){if(!String(e).includes('first-run only'))throw e;}})();
  const base=await boot(db.url,await port());
  await call(base,'/auth/me',401);
  await call(base,'/auth/login',401,{email,password:'incorrectinvalid'});
  const logged=await call(base,'/auth/login',201,{email,password});
  if(!logged.accessToken||!logged.refreshToken||!logged.user?.roles?.includes('ORGANIZATION_ADMIN'))throw new Error('Auth tokens or least-privileged role missing.');
  const me=await call(base,'/auth/me',200,undefined,logged.accessToken);
  if(me.email!==email)throw new Error('Authenticated identity mismatch.');
  // Finance endpoints reject an org admin who has no finance permission.
  await call(base,'/finance/reward-policies',403,undefined,logged.accessToken);
  const second=await call(base,'/auth/refresh',201,{refreshToken:logged.refreshToken});
  await call(base,'/auth/me',200,undefined,second.accessToken);
  await call(base,'/auth/logout',201,{refreshToken:second.refreshToken},second.accessToken);
  await call(base,'/auth/me',401,undefined,second.accessToken);
  await haltApi();
  await prisma.$disconnect();prisma=null;
  db.stop();db=null;
  // Database container stopped. Volume retains identity/role even after new startup.
  const restarted=startPersistentDevMysql();db=restarted;
  process.env.DATABASE_URL=db.url;
  prisma=new PrismaClient();
  const stored=await prisma.user.findUnique({where:{email},include:{roleAssignments:true}});
  if(!stored||!stored.roleAssignments.some(r=>r.role==='ORGANIZATION_ADMIN'))throw new Error('Account lost after database restart.');
  const base2=await boot(db.url,await port());
  const after=await call(base2,'/auth/login',201,{email,password});
  if(!after.accessToken)throw new Error('Persistent credentials cannot authenticate after DB restart.');
  console.log('PHASE 1 PERSISTENT AUTH UAT PASS: first-run bootstrap, real login/refresh/logout, 401/403, and restart persistence.');
} catch(e) {
  console.error('PHASE 1 PERSISTENT AUTH UAT FAIL:',e instanceof Error?e.message:String(e));
  process.exitCode=1;
} finally {
  await haltApi();
  await prisma?.$disconnect();
  db?.stop();
  cleanupPersistentDevCI();
}
