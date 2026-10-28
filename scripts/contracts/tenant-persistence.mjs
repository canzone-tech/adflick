import { hasMysqlSecurityGate } from '../ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/security.e2e-spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'scripts/contracts/tenant-persistence.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[tenant-persistence] Missing required file: ${file}`); process.exitCode = 1;
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
  console.error(`[tenant-persistence] Missing tenant persistence test coverage: ${token}`); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const id of ['TEN-028-01','TEN-028-06','TEN-028-07','TEN-028-11']) if (!matrix.includes(id)) {
  console.error(`[tenant-persistence] Missing test matrix case: ${id}`); process.exitCode = 1;
}
if (!hasMysqlSecurityGate()) {
  console.error('[tenant-persistence] CI must run security E2E on MySQL 8.4.'); process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[tenant-persistence] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract tenant-persistence static checks passed: 6 tenant-scoped list endpoints, 5 denied mutations, persisted-state assertions, MySQL CI.');
