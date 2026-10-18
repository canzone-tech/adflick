import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Node 24's native dotenv loader works before npm ci; never require uninstalled packages.
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
function execute(label, command, args, override = {}) {
  console.log('\n=== ' + label + ' ===');
  const result = spawnSync(command, args, {
    stdio: 'inherit', shell: false, env: { ...environment, ...override },
    ...(process.platform === 'win32' ? { windowsHide: true } : {})
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(label + ' failed with exit code ' + (result.status ?? 'signal'));
  }
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function assertDisposableDatabase() {
  if (environment.NODE_ENV === 'production') throw new Error('Refusing verification migrations in production mode.');
  if (!environment.CI && environment.ADFLICK_VERIFY_TEST_DATABASE !== '1') {
    throw new Error('Set ADFLICK_VERIFY_TEST_DATABASE=1 for a disposable local MySQL verification database.');
  }
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required for backend verification.');
  const url = new URL(environment.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Verification can only migrate a loopback-hosted disposable MySQL database.');
  }
  if (!['mysql:', 'mysql2:'].includes(url.protocol)) throw new Error('MySQL verification database required.');
}
try {
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
    execute('Backend unit tests with coverage', npm, ['run', 'test:api', '--', '--coverage']);
    execute('Production backend build', npm, ['run', 'build:api']);
    assertDisposableDatabase();
    execute('Apply immutable migrations to disposable MySQL', npx, ['prisma', 'migrate', 'deploy']);
    execute('MySQL security HTTP integration', npm, ['run', 'test:e2e:security'], { RUN_MYSQL_SECURITY_E2E: '1' });
    execute('MySQL finance transaction integration', npm, ['run', 'test:e2e:finance'], { RUN_MYSQL_FINANCE_E2E: '1' });
    execute('Compiled API startup, health and unauthorized smoke', process.execPath, ['scripts/smoke-runtime.mjs', 'api']);
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
}
