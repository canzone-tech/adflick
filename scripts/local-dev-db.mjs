// ADFLICK-only persistent DEVELOPMENT database. Never attach unrelated volumes/containers.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseDockerPort } from './verify-local-mysql.mjs';

const scope = process.env.ADFLICK_LOCAL_DEV_CI === '1' ? 'adflick-dev-ci-' + (process.env.GITHUB_RUN_ID ?? process.pid) : 'adflick-dev-local-v1';
const volumeName = scope + '-mysql-data';
const containerName = scope + '-mysql';
const stateDir = path.resolve('.adflick-local');
const statePath = path.join(stateDir, 'db.json');
const label = 'adflick.owned=local-development';
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function docker(args, timeout = 30000) {
  const x = spawnSync('docker', args, { encoding: 'utf8', shell: false, timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  if (x.error) throw new Error('Docker command unavailable or timed out: ' + x.error.code);
  return x;
}
function checked(args, timeout) {
  const x = docker(args, timeout);
  if (x.status !== 0) throw new Error('ADFLICK Docker operation failed (' + args[0] + '): ' + x.stderr.trim().slice(0, 300));
  return x.stdout.trim();
}
function inspect(type, name) {
  const r = docker([type, 'inspect', name]);
  if (r.status !== 0) return null;
  const parsed = JSON.parse(r.stdout);
  return parsed[0];
}
function metadataMatches(obj) {
  return obj?.Labels?.['adflick.owned'] === 'local-development' ||
    obj?.Config?.Labels?.['adflick.owned'] === 'local-development';
}
function assertDevelopmentHost() {
  if (process.env.NODE_ENV === 'production') throw new Error('Never start persistent developer DB in production mode.');
  if (process.versions.node.split('.')[0] !== '24') throw new Error('Requires Node.js 24.');
}
function credentials() {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  if (existsSync(statePath)) {
    if ((statSync(statePath).mode & 0o077) !== 0) throw new Error('Private local DB config must have mode 0600.');
    const v = JSON.parse(readFileSync(statePath, 'utf8'));
    if (v.scope !== scope || v.volume !== volumeName || v.container !== containerName ||
        !/^[a-f0-9]{40}$/.test(v.password) || !/^[a-f0-9]{40}$/.test(v.rootPassword)) {
      throw new Error('Local DB ownership/configuration mismatch. Refusing unsafe adoption.');
    }
    return v;
  }
  const v = { scope, container: containerName, volume: volumeName,
    password: randomBytes(20).toString('hex'), rootPassword: randomBytes(20).toString('hex') };
  writeFileSync(statePath, JSON.stringify(v) + '\n', { mode: 0o600, flag: 'wx' });
  return v;
}
export function startPersistentDevMysql() {
  assertDevelopmentHost();
  const v = credentials();
  let volume = inspect('volume', volumeName);
  if (!volume) {
    checked(['volume', 'create', '--label', label, volumeName]);
    volume = inspect('volume', volumeName);
  }
  if (!metadataMatches(volume)) throw new Error('Volume ownership missing. Refusing to access unrelated Docker volume.');
  let c = inspect('container', containerName);
  if (!c) {
    checked(['run', '--detach', '--name', containerName,
      '--label', label, '--restart', 'no', '--publish', '127.0.0.1::3306',
      '--mount', 'type=volume,source=' + volumeName + ',target=/var/lib/mysql',
      '--env', 'MYSQL_DATABASE=adflick_development',
      '--env', 'MYSQL_USER=adflick_dev',
      '--env', 'MYSQL_PASSWORD=' + v.password,
      '--env', 'MYSQL_ROOT_PASSWORD=' + v.rootPassword, 'mysql:8.4'], 300000);
    c = inspect('container', containerName);
  }
  if (!metadataMatches(c) || !c.Mounts?.some(m => m.Type === 'volume' && m.Name === volumeName && m.Destination === '/var/lib/mysql') ||
    c.HostConfig?.NetworkMode === 'host') {
    throw new Error('Container ownership, mounted volume or network safety mismatch.');
  }
  const binds = c.HostConfig?.PortBindings?.['3306/tcp'];
  if (!Array.isArray(binds) || binds.length !== 1 || binds[0].HostIp !== '127.0.0.1') {
    throw new Error('MySQL must be published on a single loopback-only port.');
  }
  const startedByUs = !c.State.Running;
  if (startedByUs) checked(['start', containerName]);
  try {
    const port = parseDockerPort(checked(['port', containerName, '3306/tcp']));
    let ready = false;
    for (let i = 0; i < 120; i++) {
      const result = docker(['exec', '--env', 'MYSQL_PWD=' + v.password,
        containerName, 'mysql', '-h127.0.0.1', '-uadflick_dev', '-Dadflick_development', '-N', '-B', '-e', 'SELECT 1'], 3500);
      if (result.status === 0 && result.stdout.trim() === '1') { ready = true; break; }
      sleep(1000);
    }
    if (!ready) throw new Error('Owned persistent MySQL is not ready in 120 seconds.');
    return { url: 'mysql://adflick_dev:' + v.password + '@127.0.0.1:' + port + '/adflick_development',
      volume: volumeName, stop() {
        if (startedByUs) {
          const current = inspect('container', containerName);
          if (metadataMatches(current)) checked(['stop', '--time', '15', containerName], 30000);
        }
      }
    };
  } catch (e) {
    if (startedByUs && metadataMatches(inspect('container', containerName))) docker(['stop', '--time', '5', containerName]);
    throw e;
  }
}
export function persistentDevMetadata() {
  return { volumeName, containerName, configPath: statePath };
}

// Only CI ephemeral runners may remove resources. A developer's persistent data is never removed.
export function cleanupPersistentDevCI() {
  if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.ADFLICK_LOCAL_DEV_CI !== '1') {
    throw new Error('Refusing persistent developer database cleanup outside dedicated CI.');
  }
  const container = inspect('container', containerName);
  if (container) {
    if (!metadataMatches(container) ||
        !container.Mounts?.some(m => m.Name === volumeName)) {
      throw new Error('Refusing removal of container with invalid ADFLICK ownership.');
    }
    checked(['rm', '--force', containerName], 30000);
  }
  const volume = inspect('volume', volumeName);
  if (volume) {
    if (!metadataMatches(volume)) throw new Error('Refusing to remove unrelated volume.');
    checked(['volume', 'rm', volumeName], 30000);
  }
}
