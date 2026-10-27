import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/playback/playback.duplicate-ingestion.spec.ts',
  'apps/api/src/payouts/payouts.export-tenant.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'scripts/check-batch31.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 31] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const playback = fs.readFileSync(path.join(root, 'apps/api/src/playback/playback.duplicate-ingestion.spec.ts'), 'utf8');
for (const token of [
  'previously persisted event as duplicate',
  'unique-key race as a duplicate',
  'countedForEligibility: false',
  'invalid device credentials',
]) if (!playback.includes(token)) {
  console.error(`[BATCH 31] Missing playback idempotency assertion: ${token}`); process.exitCode = 1;
}
const payout = fs.readFileSync(path.join(root, 'apps/api/src/payouts/payouts.service.ts'), 'utf8');
if (!payout.includes('items: { where: { organizationId } }') ||
    !payout.includes('where: { payoutBatchId: id, organizationId }')) {
  console.error('[BATCH 31] Payout export nested and direct item reads must be tenant-scoped.'); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const id of ['SEC-031-01','SEC-031-02','SEC-031-04','SEC-031-07']) if (!matrix.includes(id)) {
  console.error(`[BATCH 31] Missing security matrix case: ${id}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch31.mjs')) {
  console.error('[BATCH 31] check:source must include check-batch31.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 31 static checks passed: playback duplicate/idempotency assertions and organization-scoped payout item exports.');
