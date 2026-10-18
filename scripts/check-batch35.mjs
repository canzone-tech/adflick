import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/payouts/payouts.service.ts',
  'apps/api/src/payouts/payouts.reconcile-transaction.spec.ts',
  'docs/BATCH_35_RECONCILIATION_AUDIT_ATOMICITY.md',
  'docs/BATCH_35_FINANCE_AUDIT_ATOMICITY_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 35] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const service = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  "include: { items: { where: { organizationId } } }",
  "return tx.payoutBatch.findUniqueOrThrow({ where: { id, organizationId } });",
  "await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'PAYOUT_BATCH_RECONCILED'",
]) if (!service.includes(token)) {
  console.error(`[BATCH 35] Missing tenant/audit requirement: ${token}`); process.exitCode = 1;
}
const spec = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of ['organization predicate', 'simulated audit insert failure', 'not.toHaveBeenCalled()']) if (!spec.includes(token)) {
  console.error(`[BATCH 35] Missing regression assertion: ${token}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch35.mjs')) {
  console.error('[BATCH 35] check:source must include check-batch35.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 35 static checks passed: tenant-scoped reconciliation reads and audit failure-path coverage.');
