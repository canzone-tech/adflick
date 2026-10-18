import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export function parseDockerPort(output) {
  const lines = String(output).trim().split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length !== 1 || !/^127[.]0[.]0[.]1:[0-9]{2,5}$/.test(lines[0])) {
    throw new Error('Docker did not bind MySQL to one loopback-only TCP port.');
  }
  const port = Number(lines[0].split(':')[1]);
  if (port < 1024 || port > 65535) throw new Error('Invalid MySQL Docker ephemeral port.');
  return port;
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', timeout: options.timeout ?? 15000,
    stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true
  });
  if (result.error) {
    if (result.error.code === 'ENOENT') throw new Error('Docker CLI is required for isolated local ADFLICK verification.');
    throw new Error('Docker command did not complete (' + result.error.code + ').');
  }
  return result;
}
const sleep = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

export function startDisposableMysql() {
  const name = 'adflick-verify-' + randomBytes(8).toString('hex');
  const rootPassword = randomBytes(20).toString('hex');
  const password = randomBytes(20).toString('hex');
  const args = [
    'run', '--detach', '--rm', '--name', name,
    '--label', 'adflick.verified-disposable=true',
    '--publish', '127.0.0.1::3306',
    '--env', 'MYSQL_DATABASE=adflick_verify',
    '--env', 'MYSQL_USER=adflick_verify',
    '--env', 'MYSQL_ROOT_PASSWORD=' + rootPassword,
    '--env', 'MYSQL_PASSWORD=' + password,
    'mysql:8.4'
  ];
  const started = docker(args, { timeout: 300000 });
  if (started.status !== 0) {
    throw new Error('Unable to start an isolated MySQL 8.4 Docker container. Check Docker Desktop/Engine availability.');
  }
  const containerId = (started.stdout ?? '').trim();
  if (!/^[a-f0-9]{12,64}$/.test(containerId)) {
    throw new Error('Docker did not return a valid disposable container ID.');
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    // Never use docker compose down or prune: remove only the exact container this run created.
    const result = docker(['rm', '--force', containerId], { timeout: 20000 });
    if (result.status !== 0) console.error('WARN: Could not clean up ADFLICK disposable container ' + containerId.slice(0, 12) + '.');
  };
  try {
    const binding = docker(['port', containerId, '3306/tcp']);
    if (binding.status !== 0) throw new Error('Could not inspect disposable MySQL port.');
    const port = parseDockerPort(binding.stdout);
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      const result = docker([
        'exec', '--env', 'MYSQL_PWD=' + password, containerId,
        'mysql', '--host=127.0.0.1', '--user=adflick_verify',
        '--database=adflick_verify', '--batch', '--skip-column-names',
        '--execute=SELECT 1'
      ], { timeout: 3000 });
      if (result.status === 0 && result.stdout.trim() === '1') {
        ready = true;
        break;
      }
      sleep(1000);
    }
    if (!ready) throw new Error('Disposable MySQL 8.4 did not accept a real authenticated SELECT 1 within 120 seconds.');
    return {
      url: 'mysql://adflick_verify:' + password + '@127.0.0.1:' + port + '/adflick_verify',
      stop
    };
  } catch (error) {
    stop();
    throw error;
  }
}
