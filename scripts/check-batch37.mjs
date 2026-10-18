import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/finance-transaction.mysql.e2e-spec.ts',
  'docs/BATCH_37_MYSQL_CONCURRENT_RECONCILIATION.md',
  'docs/BATCH_37_FINANCE_CONCURRENCY_ACCEPTANCE_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 37] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ["startsWith('mysql://')", "BATCH_37_STALE_TRANSITION_CONFLICT", "Promise.allSettled", "toHaveLength(1)", "BATCH_37_CONCURRENT_WINNER_A", "PayoutBatchStatus.PARTIALLY_RECONCILED"]) {
  if (!test.includes(token)) { console.error(`[BATCH 37] Missing concurrency guard/assertion: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch37.mjs')) { console.error('[BATCH 37] check:source must include check-batch37.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 37 static checks passed: MySQL concurrent reconciliation single-winner coverage.');
