import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'scripts/run-reconciliation-release-gate.mjs',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'apps/api/src/finance/reconciliation/reconciliation-import.processing.spec.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import-idempotency.spec.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import-observability.spec.ts',
  'apps/api/test/reconciliation-import.mysql.e2e-spec.ts',
  'apps/api/test/reconciliation-import.http.e2e-spec.ts',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[reconciliation-release] Missing ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const gate = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ['mysql://', '127.0.0.1', 'localhost', 'RUN_MYSQL_FINANCE_E2E', 'check:source', 'prisma', 'test:e2e:finance']) {
  if (!gate.includes(token)) { console.error(`[reconciliation-release] Release gate missing safeguard/step: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-release] check:source not wired'); process.exitCode = 1; }
if (!pkg.scripts?.['verify:reconciliation:release']?.includes('run-reconciliation-release-gate.mjs')) { console.error('[reconciliation-release] release gate command not wired'); process.exitCode = 1; }
const docs = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const token of ['disposable local MySQL 8.4', 'create or enable live payouts', 'runtime tests are not implied by static checks']) {
  if (!docs.includes(token)) { console.error(`[reconciliation-release] Release documentation missing: ${token}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log('Contract reconciliation-release static checks passed: reproducible reconciliation release gate, local-MySQL safeguards, unit/E2E command wiring and explicit payout boundary.');
