import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/finance/providers/reconciliation-match.ts',
  'apps/api/src/finance/providers/reconciliation-match.spec.ts',
  'docs/BATCH_38_RECONCILIATION_IDEMPOTENCY.md',
  'docs/BATCH_38_RECONCILIATION_IDEMPOTENCY_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 38] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const matcher = fs.readFileSync(path.join(root, required[0]), 'utf8');
const tests = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of ['payoutByProviderReference', 'Provider transaction reference is reused for a different payout.', 'Duplicate provider/reference pair in import.']) {
  if (!matcher.includes(token)) { console.error(`[BATCH 38] Missing reference-safety guard: ${token}`); process.exitCode = 1; }
}
for (const token of ['rejects duplicate provider transaction references across different payouts', 'flags an identical provider/payout row repeated in one import']) {
  if (!tests.includes(token)) { console.error(`[BATCH 38] Missing regression test: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch38.mjs')) { console.error('[BATCH 38] check:source must include check-batch38.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 38 static checks passed: provider reference reuse and duplicate import-row guards.');
