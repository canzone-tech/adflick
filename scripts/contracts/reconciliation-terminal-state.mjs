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
  console.error(`[reconciliation-terminal-state] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const service = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  'status: { notIn: [PayoutItemStatus.PAID, PayoutItemStatus.REVERSED] }',
  'if (changed.count !== 1) throw new ConflictException',
  'where: { payoutBatchId: id, organizationId }',
  'payoutBatchId: id, organizationId, status: PayoutItemStatus.EXPORTED',
]) if (!service.includes(token)) {
  console.error(`[reconciliation-terminal-state] Missing reconciliation race/tenant assertion: ${token}`); process.exitCode = 1;
}
const spec = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of ['stale reconciliation write', 'not.toHaveBeenCalled()', "organizationId: 'org-a'"]) if (!spec.includes(token)) {
  console.error(`[reconciliation-terminal-state] Missing unit test assertion: ${token}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[reconciliation-terminal-state] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract reconciliation-terminal-state static checks passed: conditional terminal-state protection, organization-scoped reconciliation reads, and provider submission update predicates.');
