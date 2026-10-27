import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

const target = process.argv[2];
if (!['api', 'web'].includes(target)) throw new Error('Smoke target must be api or web');
const entry = target === 'api' ? 'apps/api/dist/main.js' : 'apps/web/.next/standalone/apps/web/server.js';
if (!existsSync(entry)) throw new Error('Compiled entrypoint missing: ' + entry);
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function probe(url, expected) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2500) });
  if (response.status !== expected) throw new Error('Expected HTTP ' + expected + ', got ' + response.status + ' at ' + new URL(url).pathname);
  return response;
}
async function ready(url, child) {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Compiled app exited early with code ' + child.exitCode);
    try { return await probe(url, 200); } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw lastError ?? new Error('Readiness timed out');
}
async function main() {
  const port = await freePort();
  const env = { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), SCHEDULER_ENABLED: 'false', ALERT_SCAN_ENABLED: 'false', NOTIFICATION_OUTBOX_ENABLED: 'false' };
  if (target === 'api') env.API_PORT = String(port);
  const child = spawn(process.execPath, [entry], { env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-4000); });
  }
  const base = 'http://127.0.0.1:' + port;
  try {
    if (target === 'api') {
      await ready(base + '/api/v1/health', child);
      await probe(base + '/api/v1/ready', 200);
      await probe(base + '/api/v1/auth/me', 401);
    } else {
      await ready(base + '/', child);
      for (const page of ['/login', '/finance', '/fleet', '/cms', '/communications', '/email-verification', '/phone-verification', '/member-onboarding', '/member-operations', '/join']) {
        const response = await probe(base + page, 200);
        if (!(response.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Unexpected content-type for ' + page);
      }
    }
    console.log('Compiled ' + target + ' runtime smoke PASS.');
  } catch (error) {
    console.error('Compiled runtime smoke FAILED: ' + String(error));
    console.error('App diagnostics (truncated): ' + diagnostics.replace(/(secret|password|token)=\S+/gi, '$1=[REDACTED]'));
    process.exitCode = 1;
  } finally {
    if (child.pid) {
      try {
        if (process.platform === 'win32') child.kill('SIGTERM');
        else process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
  }
}
await main();
