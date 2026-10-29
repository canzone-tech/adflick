// ADFLICK localhost-only development runtime. Does not use Docker Compose or shared databases.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';
import process from 'node:process';
import { startDisposableMysql } from './verify-local-mysql.mjs';

const commandMode = process.argv[2];
const persistentDevelopment = ['--persistent-dev', '--persistent-dev-uat'].includes(commandMode);
const browserUat = ['--browser-uat', '--persistent-dev-uat'].includes(commandMode);
if (process.argv.length > 3 || (process.argv.length > 2 && !browserUat && !persistentDevelopment)) throw new Error('Usage: local:up, local:uat, local:dev:up or local:dev:uat');
if (process.versions.node.split('.')[0] !== '24') throw new Error('ADFLICK local runtime requires Node.js 24.');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to start local runtime in NODE_ENV=production.');
if (!existsSync('node_modules/.bin/prisma') || !existsSync('node_modules/.bin/next')) {
  throw new Error('Dependencies not installed. The authoritative first-time gate is npm run verify.');
}

function localMfaEncryptionKey(persistent) {
  if (process.env.MFA_ENCRYPTION_KEY?.trim()) return process.env.MFA_ENCRYPTION_KEY.trim();
  if (!persistent) return randomBytes(32).toString('base64url');
  const directory = '.adflick-local';
  const file = join(directory, 'mfa-encryption.key');
  mkdirSync(directory, { recursive: true });
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim();
    if (Buffer.from(existing, 'base64url').length !== 32) throw new Error('Stored local MFA encryption key is invalid; refusing to continue.');
    return existing;
  }
  const created = randomBytes(32).toString('base64url');
  writeFileSync(file, created + '\n', { mode: 0o600 });
  return created;
}

const live = new Set();
let mysql;
let stopping = false;
function terminate(child) {
  if (!child?.pid || child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {
    try { child.kill('SIGTERM'); } catch {}
  }
}
function cleanup() {
  if (stopping) return;
  stopping = true;
  for (const child of live) terminate(child);
  if (mysql) {
    mysql.stop();
    mysql = undefined;
  }
}
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });
process.once('exit', cleanup);

function run(command, args, env, name, inherit = false) {
  const child = spawn(command, args, {
    env, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], detached: true,
    shell: false, windowsHide: true
  });
  live.add(child);
  const diag = { text: '' };
  if (!inherit) for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    // Avoid echoing application environment, tokens, or database credentials to terminal.
    diag.text = (diag.text + String(chunk)).slice(-1800);
  });
  child.on('exit', () => live.delete(child));
  child.on('error', error => { diag.text = String(error); });
  return { child, diag, name };
}
async function command(label, executable, args, env) {
  console.log('ADFLICK setup: ' + label);
  const p = run(executable, args, env, label, true);
  const exit = await new Promise(resolve => {
    p.child.once('error', error => resolve({ error }));
    p.child.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (exit.error || exit.code !== 0) throw new Error(label + ' FAILED (' + (exit.error?.code ?? exit.signal ?? exit.code) + ')');
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function probe(url, expected = 200) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2500) });
  if (response.status !== expected) throw new Error('HTTP ' + response.status + ' != ' + expected + ' at ' + new URL(url).pathname);
  return response;
}
async function waitFor(url, p, label) {
  let issue;
  for (let attempt = 0; attempt < 130; attempt++) {
    if (p.child.exitCode !== null) throw new Error(label + ' exited (' + p.child.exitCode + ').');
    try { return await probe(url); } catch (error) { issue = error; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(label + ' did not become ready; ' + String(issue));
}

async function main() {
  const apiPort = await freePort();
  let webPort = await freePort();
  while (webPort === apiPort) webPort = await freePort();
  const apiUrl = 'http://127.0.0.1:' + apiPort + '/api/v1';
  const webUrl = 'http://127.0.0.1:' + webPort;
  console.log(persistentDevelopment ? 'ADFLICK persistent DEVELOPMENT session (owned MySQL volume; no other projects touched).' : 'ADFLICK local session: isolated MySQL 8.4; random localhost ports; no shared Compose services.');
  mysql = persistentDevelopment ? (await import('./local-dev-db.mjs')).startPersistentDevMysql() : startDisposableMysql();
  const common = {
    ...process.env,
    CI: browserUat ? 'true' : 'false',
    NODE_ENV: 'development',
    DATABASE_URL: mysql.url,
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    MFA_ENCRYPTION_KEY: localMfaEncryptionKey(persistentDevelopment),
    WEB_ORIGIN: webUrl,
    NEXT_PUBLIC_API_BASE_URL: apiUrl,
    SCHEDULER_ENABLED: 'false',
    ALERT_SCAN_ENABLED: 'false',
    NOTIFICATION_OUTBOX_ENABLED: 'false',
    API_HOST: '127.0.0.1',
    API_PORT: String(apiPort)
  };
  const buildEnv = { ...common, NODE_ENV: 'production' };
  await command('Prisma client generation', 'node_modules/.bin/prisma', ['generate'], common);
  await command('Apply ADFLICK migrations to the disposable MySQL only', 'node_modules/.bin/prisma', ['migrate', 'deploy'], common);
  if (browserUat) {
    // Both disposable local:uat and CI persistent-dev-uat need an actual
    // test-only session. Never insert these accounts in an operator's persistent DB.
    if (persistentDevelopment &&
        (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' || process.env.ADFLICK_LOCAL_DEV_CI !== '1')) {
      throw new Error('Persistent authenticated browser UAT is CI only.');
    }
    const { PrismaClient } = await import('@prisma/client');
    const { createFirstAdmin } = await import('../prisma/first-admin.mjs');
    process.env.DATABASE_URL = mysql.url;
    const prisma = new PrismaClient();
    try {
      const userEmail = 'uat+' + randomBytes(5).toString('hex') + '@adflick.example.test';
      const userPassword = randomBytes(24).toString('hex');
      await createFirstAdmin(prisma, { organization: 'ADFLICK Browser CI', displayName: 'Browser Operator', email: userEmail, password: userPassword });
      common.ADFLICK_BROWSER_TEST_EMAIL = userEmail;
      common.ADFLICK_BROWSER_TEST_PASSWORD = userPassword;
    } finally { await prisma.$disconnect(); }
  }
  await command('Build the compiled API', 'npm', ['run', 'build:api'], common);
  await command('Build the UI against this session API URL', 'npm', ['run', 'build:web'], buildEnv);

  const apiEntry = 'apps/api/dist/main.js';
  const webEntry = 'apps/web/.next/standalone/apps/web/server.js';
  if (!existsSync(apiEntry) || !existsSync(webEntry)) throw new Error('Compiled API or standalone web entrypoint missing.');
  const assetSource = 'apps/web/.next/static';
  const assetDest = 'apps/web/.next/standalone/apps/web/.next/static';
  if (!existsSync(assetSource)) throw new Error('Next.js static assets are missing after build.');
  mkdirSync('apps/web/.next/standalone/apps/web/.next', { recursive: true });
  cpSync(assetSource, assetDest, { recursive: true, force: true });
  if (existsSync('apps/web/public')) cpSync('apps/web/public', 'apps/web/.next/standalone/apps/web/public', { recursive: true, force: true });

  const api = run(process.execPath, [apiEntry], common, 'compiled API');
  await waitFor(apiUrl + '/health', api, 'API');
  await probe(apiUrl + '/ready');
  await probe(apiUrl + '/auth/me', 401);
  const web = run(process.execPath, [webEntry], { ...buildEnv, HOSTNAME: '127.0.0.1', PORT: String(webPort) }, 'compiled web');
  await waitFor(webUrl + '/login', web, 'Web');
  // A public HTML page is needed for the static-asset smoke; dashboard
  // now requires a real authenticated server session.
  await probe(webUrl + '/', 307);
  const page = await (await probe(webUrl + '/login')).text();
  const asset = page.match(/(?:src|href)="([^"]*\/_next\/static\/[^"]+\.(?:js|css))"/)?.[1];
  if (!asset) throw new Error('Next HTML has no static JS/CSS asset for visual rendering.');
  const assetResponse = await probe(new URL(asset, webUrl).toString());
  if (!(assetResponse.headers.get('content-type') ?? '').match(/javascript|css/)) throw new Error('Compiled Next.js JavaScript/CSS was not served with a valid type.');
  console.log('\nADFLICK LOCAL READY');
  console.log('Dashboard (login required): ' + webUrl);
  console.log('Login:     ' + webUrl + '/login');
  console.log('CMS:       ' + webUrl + '/cms');
  console.log('API health:' + apiUrl + '/health');
  console.log(persistentDevelopment ? 'Database:  persistent ADFLICK-only MySQL 8.4 volume; survives Ctrl+C and relaunch' : 'Database:  disposable Docker MySQL 8.4 (localhost only; will be destroyed on exit)');
  if (browserUat) {
    try {
      await command('Real headless Chrome browser UAT', process.execPath, ['scripts/browser-uat.mjs', webUrl, apiUrl], { ...common, ADFLICK_UAT_URL: webUrl });
      console.log('BROWSER UAT PASS (isolated compiled runtime).');
    } catch (e) {
      // Diagnostics only: statuses and process liveness, never secrets or DB URLs.
      const healthStatus = await fetch(apiUrl + '/health', { signal: AbortSignal.timeout(2000) })
        .then(r => r.status).catch(() => 0);
      console.error('ADFLICK browser UAT dependency status: API health HTTP ' + healthStatus
        + ', API process alive=' + (api.child.exitCode === null)
        + ', WEB process alive=' + (web.child.exitCode === null));
      throw e;
    }
  } else {
    console.log('Open the URLs in your Ubuntu browser. Press Ctrl+C to stop only ADFLICK application services.' + (persistentDevelopment ? ' MySQL volume will be preserved.' : ''));
    await Promise.race([
      new Promise(resolve => api.child.once('exit', () => resolve('API stopped unexpectedly'))),
      new Promise(resolve => web.child.once('exit', () => resolve('Web stopped unexpectedly')))
    ]).then(reason => { throw new Error(reason); });
  }
}
try {
  await main();
} catch (error) {
  console.error('ADFLICK local runtime FAILED: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  cleanup();
  if (commandMode === '--persistent-dev-uat') {
    const { cleanupPersistentDevCI } = await import('./local-dev-db.mjs');
    cleanupPersistentDevCI();
  }
}
