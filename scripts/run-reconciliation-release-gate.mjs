import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const env = process.env;
const run = (label, command, args, extraEnv = {}) => {
  console.log(`\n[BATCH 47] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...env, ...extraEnv }, shell: process.platform === 'win32' });
  if (result.error) { console.error(result.error.message); process.exit(result.status ?? 1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('[BATCH 47] Node.js 22 or newer is required.'); process.exit(2);
}
if (!fs.existsSync('node_modules') || !fs.existsSync('apps/api/node_modules')) {
  console.error('[BATCH 47] Dependencies are not installed. Run npm ci from the repository root after providing a committed package-lock.json; this gate will not install or modify dependencies automatically.');
  process.exit(2);
}
const runMysql = env.RUN_MYSQL_FINANCE_E2E === '1';
if (runMysql) {
  if (!env.DATABASE_URL?.startsWith('mysql://')) {
    console.error('[BATCH 47] RUN_MYSQL_FINANCE_E2E=1 requires DATABASE_URL=mysql://...'); process.exit(2);
  }
  if (!env.DATABASE_URL.includes('127.0.0.1') && !env.DATABASE_URL.includes('localhost')) {
    console.error('[BATCH 47] Refusing a non-local database. Use a disposable local MySQL 8.4 test database.'); process.exit(2);
  }
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
    console.error('[BATCH 47] MySQL HTTP E2E requires JWT_ACCESS_SECRET of at least 32 characters.'); process.exit(2);
  }
}
run('Cumulative static source checks', 'npm', ['run', 'check:source']);
run('Prisma schema validation', 'npx', ['prisma', 'validate']);
run('Focused reconciliation unit tests', 'npm', ['run', 'test', '-w', 'apps/api', '--', '--runTestsByPath',
  'src/finance/reconciliation/reconciliation-import.processing.spec.ts',
  'src/finance/reconciliation/reconciliation-import-idempotency.spec.ts',
  'src/finance/reconciliation/reconciliation-import-observability.spec.ts',
  'src/finance/reconciliation/reconciliation-import.read.spec.ts']);
if (runMysql) {
  run('MySQL finance integration and HTTP E2E tests', 'npm', ['run', 'test:e2e:finance', '-w', 'apps/api'], { RUN_MYSQL_FINANCE_E2E: '1' });
} else {
  console.log('\n[BATCH 47] MySQL integration tests skipped: set RUN_MYSQL_FINANCE_E2E=1 with a disposable local MySQL 8.4 database to opt in.');
}
console.log('\n[BATCH 47] Requested release-gate commands completed. This is not payment-provider certification; live transfers remain disabled until separate finance/security approval.');
