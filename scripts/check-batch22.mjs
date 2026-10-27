import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/auth/tenant-scope.ts',
  'apps/api/src/auth/tenant-scope.spec.ts',
  'apps/api/src/campaigns/campaigns.service.ts',
  'apps/api/src/cms/cms.service.ts',
  'apps/api/src/incidents/incidents.service.ts',
  'apps/api/src/finance/finance.service.ts',
  'apps/api/src/payouts/payouts.service.ts',
  'apps/api/src/scheduler/assignments.service.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing Batch 22 file: ${file}`);
    process.exitCode = 1;
  }
}
const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) {
  console.error('Prisma provider must remain MySQL.');
  process.exitCode = 1;
}
const checks = [
  ['apps/api/src/campaigns/campaigns.service.ts', 'organizationId: current.organizationId'],
  ['apps/api/src/campaigns/campaigns.service.ts', 'organizationId: orgId'],
  ['apps/api/src/cms/cms.service.ts', 'where: { id: layout.id, organizationId }'],
  ['apps/api/src/cms/cms.service.ts', 'where: { id: playlist.id, organizationId }'],
  ['apps/api/src/incidents/incidents.service.ts', 'where: { id, organizationId }'],
  ['apps/api/src/finance/finance.service.ts', 'where: { id: approval.rewardCalculationId, organizationId }'],
  ['apps/api/src/payouts/payouts.service.ts', 'where: { id, organizationId }'],
  ['apps/api/src/payouts/payouts.service.ts', 'where: { id: item.payoutItemId, organizationId }'],
  ['apps/api/src/scheduler/assignments.service.ts', 'where: { id: assignment.id, organizationId }'],
];
for (const [file, token] of checks) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  if (!source.includes(token)) {
    console.error(`Missing tenant-scoped mutation pattern in ${file}: ${token}`);
    process.exitCode = 1;
  }
}
const tests = fs.readFileSync(path.join(process.cwd(), 'docs/BATCH-HISTORY.md'), 'utf8');
for (const id of ['TEN-001', 'TEN-010', 'TEN-017', 'TEN-020']) {
  if (!tests.includes(id)) {
    console.error(`Regression matrix missing ${id}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Batch 22 static checks passed.');
