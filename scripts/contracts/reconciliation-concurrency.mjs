import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/finance-transaction.mysql.e2e-spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[reconciliation-concurrency] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ["startsWith('mysql://')", "BATCH_37_STALE_TRANSITION_CONFLICT", "Promise.allSettled", "toHaveLength(1)", "BATCH_37_CONCURRENT_WINNER_A", "PayoutBatchStatus.PARTIALLY_RECONCILED"]) {
  if (!test.includes(token)) { console.error(`[reconciliation-concurrency] Missing concurrency guard/assertion: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-concurrency] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Contract reconciliation-concurrency static checks passed: MySQL concurrent reconciliation single-winner coverage.');
