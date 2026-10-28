import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/payouts/payouts.service.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'scripts/contracts/payout-concurrency.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[payout-concurrency] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, 'apps/api/src/payouts/payouts.service.spec.ts'), 'utf8');
for (const token of [
  'stale concurrent decision',
  'updateMany',
  'PayoutBatchStatus.PENDING_APPROVAL',
  'expect(tx.auditEvent.create).not.toHaveBeenCalled()',
  'creator from approving their own batch',
  'writes the approval audit only after',
]) if (!test.includes(token)) {
  console.error(`[payout-concurrency] Missing payout concurrency assertion: ${token}`); process.exitCode = 1;
}
const service = fs.readFileSync(path.join(root, 'apps/api/src/payouts/payouts.service.ts'), 'utf8');
if (!service.includes('Payout batch was changed by another request. Refresh and retry.') ||
    !service.includes('where: { id, organizationId, status: PayoutBatchStatus.PENDING_APPROVAL }')) {
  console.error('[payout-concurrency] Conditional payout approval transition missing.'); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const id of ['SEC-029-01','SEC-029-04','SEC-029-07','SEC-029-08','SEC-029-10']) if (!matrix.includes(id)) {
  console.error(`[payout-concurrency] Missing security test matrix case: ${id}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[payout-concurrency] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract payout-concurrency static checks passed: payout race guard, maker-checker tests, concurrency/export/playback acceptance matrix.');
