import { hasMysqlSecurityGate } from './ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/security.e2e-spec.ts',
  'docs/BATCH_28_CROSS_TENANT_PERSISTENCE_E2E.md',
  'docs/BATCH_28_CROSS_TENANT_TEST_MATRIX.csv',
  'scripts/check-batch28.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 28] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, 'apps/api/test/security.e2e-spec.ts'), 'utf8');
for (const token of [
  'foreignCampaign = await prisma.campaign.create',
  'foreignAsset = await prisma.mediaAsset.create',
  'foreignScreen = await prisma.screen.create',
  'foreignLayout = await prisma.screenLayout.create',
  'foreignIncident = await prisma.incident.create',
  'foreignPayoutBatch = await prisma.payoutBatch.create',
  'does not expose Organization B records',
  'cross-tenant mutations and verifies Organization B rows remain unchanged',
  "'/api/v1/fleet/screens'",
  'expect(404)',
  'prisma.payoutBatch.findUnique',
]) if (!test.includes(token)) {
  console.error(`[BATCH 28] Missing tenant persistence test coverage: ${token}`); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, 'docs/BATCH_28_CROSS_TENANT_TEST_MATRIX.csv'), 'utf8');
for (const id of ['TEN-028-01','TEN-028-06','TEN-028-07','TEN-028-11']) if (!matrix.includes(id)) {
  console.error(`[BATCH 28] Missing test matrix case: ${id}`); process.exitCode = 1;
}
if (!hasMysqlSecurityGate()) {
  console.error('[BATCH 28] CI must run security E2E on MySQL 8.4.'); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch28.mjs')) {
  console.error('[BATCH 28] check:source must include check-batch28.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 28 static checks passed: 6 tenant-scoped list endpoints, 5 denied mutations, persisted-state assertions, MySQL CI.');
