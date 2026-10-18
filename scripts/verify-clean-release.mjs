import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const failures = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) failures.push(name);
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const pkg = readJson('package.json');
check('Node.js major version >= 22', Number(process.versions.node.split('.')[0]) >= 22, process.version);
let npmVersion = 'unavailable';
try { npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(); } catch {}
check('npm major version >= 10', Number(npmVersion.split('.')[0]) >= 10, npmVersion);
check('Root package manifest exists', fs.existsSync('package.json'));
check('Root lockfile exists', fs.existsSync('package-lock.json'), 'Generate and review with npm registry access, then commit it.');
if (fs.existsSync('package-lock.json')) {
  try {
    const lock = readJson('package-lock.json');
    check('Lockfile version is supported', Number(lock.lockfileVersion) >= 3, String(lock.lockfileVersion));
    check('Lockfile root package matches manifest', lock.packages?.['']?.name === pkg.name, `${lock.packages?.['']?.name ?? 'missing'} vs ${pkg.name}`);
  } catch (error) {
    check('Lockfile parses as JSON', false, String(error));
  }
}
for (const workspace of pkg.workspaces ?? []) {
  check(`Workspace manifest: ${workspace}`, fs.existsSync(`${workspace}/package.json`));
}
for (const file of ['prisma/schema.prisma', '.github/workflows/ci.yml', 'scripts/check-source.mjs']) {
  check(`Required release file: ${file}`, fs.existsSync(file));
}
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
check('CI uses deterministic npm ci', ci.includes('npm ci --no-audit --no-fund'));
check('CI does not bootstrap a temporary lockfile', !ci.includes('npm install --package-lock-only'));
console.log('Clean release preflight report');
for (const item of checks) console.log(`${item.status} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}`);
if (failures.length) {
  console.error(`\nRelease preflight blocked: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nPreflight passed. This does not replace npm ci, tests, Prisma validation, MySQL integration tests, or production builds.');
