import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/campaigns/campaigns.nested-tenant.spec.ts',
  'apps/api/src/payouts/payouts.export-tenant.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'scripts/contracts/nested-tenant-access.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[nested-tenant-access] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const campaign = fs.readFileSync(path.join(root, 'apps/api/src/campaigns/campaigns.nested-tenant.spec.ts'), 'utf8');
for (const token of [
  'foreign-organization creative before',
  'foreign-organization screen target',
  "organizationId: 'org-a'",
  'expect(prisma.$transaction).not.toHaveBeenCalled()',
]) if (!campaign.includes(token)) {
  console.error(`[nested-tenant-access] Missing nested tenant assertion: ${token}`); process.exitCode = 1;
}
const payout = fs.readFileSync(path.join(root, 'apps/api/src/payouts/payouts.export-tenant.spec.ts'), 'utf8');
for (const token of [
  'does not export another organization batch',
  "where: { id: 'batch-org-b', organizationId: 'org-a' }",
  'expect(prisma.$transaction).not.toHaveBeenCalled()',
]) if (!payout.includes(token)) {
  console.error(`[nested-tenant-access] Missing export tenant assertion: ${token}`); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const id of ['SEC-030-01','SEC-030-03','SEC-030-04','SEC-030-07']) if (!matrix.includes(id)) {
  console.error(`[nested-tenant-access] Missing security matrix case: ${id}`); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[nested-tenant-access] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract nested-tenant-access static checks passed: nested creative/screen tenant guards, payout export boundary and playback/concurrency acceptance matrix.');
