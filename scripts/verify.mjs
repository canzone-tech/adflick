import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) process.loadEnvFile('.env');
const mode = process.argv[2] ?? '--all';
if (!['--all', '--backend', '--frontend'].includes(mode)) {
  console.error('Usage: node scripts/verify.mjs [--all|--backend|--frontend]');
  process.exit(2);
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 24) {
  console.error('ADFLICK verification requires Node.js 24. Current: ' + process.version);
  process.exit(1);
}
const environment = { ...process.env, SCHEDULER_ENABLED: 'false', ALERT_SCAN_ENABLED: 'false', NOTIFICATION_OUTBOX_ENABLED: 'false' };
if (!environment.MFA_ENCRYPTION_KEY) environment.MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
const parsedTimeout = Number(process.env.ADFLICK_VERIFY_STEP_TIMEOUT_SECONDS ?? 300);
if (!Number.isInteger(parsedTimeout) || parsedTimeout < 30 || parsedTimeout > 900) {
  console.error('ADFLICK_VERIFY_STEP_TIMEOUT_SECONDS must be an integer from 30 to 900.');
  process.exit(2);
}
const defaultTimeoutMs = parsedTimeout * 1000;
function execute(label, command, args, override = {}) {
  const started = Date.now();
  console.log('\n=== ' + label + ' ===');
  const result = spawnSync(command, args, {
    stdio: 'inherit', shell: false, timeout: defaultTimeoutMs, killSignal: 'SIGTERM',
    env: { ...environment, ...override },
    ...(process.platform === 'win32' ? { windowsHide: true } : {})
  });
  const elapsedSeconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error?.code === 'ETIMEDOUT') throw new Error(label + ' TIMED OUT after ' + elapsedSeconds + 's (limit ' + parsedTimeout + 's); see the preceding stage output.');
  if (result.error) throw new Error(label + ' could not start: ' + result.error.message);
  if (result.status !== 0) throw new Error(label + ' FAILED after ' + elapsedSeconds + 's; exit=' + (result.status ?? 'signal ' + (result.signal ?? 'unknown')));
  console.log('PASS: ' + label + ' (' + elapsedSeconds + 's)');
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function assertDisposableDatabase() {
  if (environment.NODE_ENV === 'production') throw new Error('Refusing verification migrations in production mode.');
  if (!environment.CI && environment.ADFLICK_VERIFY_TEST_DATABASE !== '1') throw new Error('Set ADFLICK_VERIFY_TEST_DATABASE=1 for a disposable local MySQL verification database.');
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required for backend verification.');
  const url = new URL(environment.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Verification can only migrate a loopback-hosted disposable MySQL database.');
  if (!['mysql:', 'mysql2:'].includes(url.protocol)) throw new Error('MySQL verification database required.');
}
let disposableMysql;
function cleanupDisposableMysql() {
  if (disposableMysql) { disposableMysql.stop(); disposableMysql = undefined; }
}
process.once('SIGINT', () => { cleanupDisposableMysql(); process.exit(130); });
process.once('SIGTERM', () => { cleanupDisposableMysql(); process.exit(143); });
try {
  if (environment.CI === 'true') execute('Clean CI workspace before verification', 'git', ['clean', '-ffdx']);
  if (environment.CI !== 'true' && mode !== '--frontend') {
    if (environment.NODE_ENV === 'production') throw new Error('Refusing automatic local test DB setup in production mode.');
    console.log('Starting disposable MySQL 8.4 on a random localhost port; no existing database will be touched.');
    const { startDisposableMysql } = await import('./verify-local-mysql.mjs');
    disposableMysql = startDisposableMysql();
    environment.DATABASE_URL = disposableMysql.url;
    environment.ADFLICK_VERIFY_TEST_DATABASE = '1';
    environment.NODE_ENV = 'test';
    environment.JWT_ACCESS_SECRET = 'local-only-' + randomBytes(32).toString('hex');
    environment.JWT_REFRESH_SECRET = 'local-only-' + randomBytes(32).toString('hex');
    environment.MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
  }
  if (!existsSync('package-lock.json')) throw new Error('Root package-lock.json is missing.');
  execute('Deterministic dependency install', npm, ['ci', '--no-audit', '--no-fund']);
  execute('Dependency and runtime contract', npm, ['run', 'verify:dependencies']);
  execute('Clean release preflight', npm, ['run', 'verify:clean-release']);
  if (mode !== '--frontend') {
    execute('Batch static source regression', npm, ['run', 'check:source']);
    execute('Validate environment', npm, ['run', 'validate:env']);
    execute('Prisma schema validation', npx, ['prisma', 'validate']);
    execute('Generate Prisma client', npx, ['prisma', 'generate']);
    execute('Backend typecheck', npm, ['run', 'typecheck:api']);
    execute('Backend lint', npm, ['run', 'lint', '-w', 'apps/api']);
    execute('Backend unit tests with coverage', npm, ['run', 'test:api:coverage']);
    execute('Production backend build', npm, ['run', 'build:api']);
    assertDisposableDatabase();
    execute('Compiled API startup, health and unauthorized smoke', process.execPath, ['scripts/smoke-runtime.mjs', 'api']);
    execute('Local disposable MySQL safety regression', process.execPath, ['--test', 'scripts/verify-local-mysql.test.mjs']);
    execute('FK contract regression tests', process.execPath, ['--test', 'scripts/migration-fk-audit.test.mjs']);
    execute('Historical FK collation check', process.execPath, ['scripts/check-migration-fks.mjs']);
    assertDisposableDatabase();
    execute('Apply immutable migrations to disposable MySQL', npx, ['prisma', 'migrate', 'deploy']);
    execute('MySQL security HTTP integration', npm, ['run', 'test:e2e:security'], { RUN_MYSQL_SECURITY_E2E: '1' });
    execute('MySQL finance transaction integration', npm, ['run', 'test:e2e:finance'], { RUN_MYSQL_FINANCE_E2E: '1' });
  }
  if (mode !== '--backend') {
    execute('Frontend typecheck', npm, ['run', 'typecheck:web']);
    execute('Frontend lint', npm, ['run', 'lint', '-w', 'apps/web']);
    execute('Frontend production build', npm, ['run', 'build:web'], { NODE_ENV: 'production' });
    execute('Compiled public/admin web route smoke', process.execPath, ['scripts/smoke-runtime.mjs', 'web'], { NODE_ENV: 'production' });
  }
  console.log('\nVerification PASS: ' + mode + '. This does not authorize production deployment.');
} catch (error) {
  console.error('\nVerification FAILED: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  cleanupDisposableMysql();
}
