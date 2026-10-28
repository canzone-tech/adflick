import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/payouts/payouts.service.ts',
  'apps/api/src/payouts/payouts.reconcile-concurrency.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[payout-state-transition] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const service = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  'const batchTransition = await tx.payoutBatch.updateMany({',
  'status: { in: [PayoutBatchStatus.SUBMITTED_TO_PROVIDER, PayoutBatchStatus.RECONCILIATION_REQUIRED, PayoutBatchStatus.PARTIALLY_RECONCILED] }',
  'if (batchTransition.count !== 1) throw new ConflictException',
  "action: 'PAYOUT_BATCH_RECONCILED'",
  'return tx.payoutBatch.findUniqueOrThrow({ where: { id, organizationId } });',
]) if (!service.includes(token)) {
  console.error(`[payout-state-transition] Missing conditional transition requirement: ${token}`); process.exitCode = 1;
}
const spec = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of ['stale batch transition', 'conditional batch transition succeeds', 'expect(tx.auditEvent.create).not.toHaveBeenCalled()']) if (!spec.includes(token)) {
  console.error(`[payout-state-transition] Missing regression test assertion: ${token}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[payout-state-transition] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract payout-state-transition static checks passed: conditional payout batch transition, organization scope, and audit ordering.');
