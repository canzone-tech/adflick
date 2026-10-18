import { hasMysqlMigrationGate } from './ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/campaigns/campaigns.tenant-isolation.spec.ts',
  'apps/api/src/incidents/incidents.tenant-isolation.spec.ts',
  'apps/api/src/payouts/payouts.tenant-isolation.spec.ts',
  'docs/BATCH_23_AUTOMATED_TENANT_REGRESSION_QA.md',
  'docs/BATCH_23_TENANT_TEST_CASES.csv',
  '.github/workflows/ci.yml',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing Batch 23 file: ${file}`);
    process.exitCode = 1;
  }
}
const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) {
  console.error('Prisma provider must remain MySQL.');
  process.exitCode = 1;
}
const jestConfig = fs.readFileSync('apps/api/jest.config.cjs', 'utf8');
const apiPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/api/package.json'), 'utf8'));
if (!apiPkg.scripts?.test?.includes('--config ./jest.config.cjs') || !jestConfig.includes('ts-jest') || !jestConfig.includes('testRegex')) {
  console.error('Jest must be configured to discover TypeScript spec files through ts-jest.');
  process.exitCode = 1;
}
const expectedTests = [
  ['apps/api/src/campaigns/campaigns.tenant-isolation.spec.ts', 'campaign.update'],
  ['apps/api/src/incidents/incidents.tenant-isolation.spec.ts', 'incident.update'],
  ['apps/api/src/payouts/payouts.tenant-isolation.spec.ts', '$transaction'],
];
for (const [file, token] of expectedTests) {
  const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  if (!content.includes(token)) {
    console.error(`Regression test ${file} missing assertion token ${token}`);
    process.exitCode = 1;
  }
}
if (!hasMysqlMigrationGate()) {
  console.error('CI must use MySQL 8.4 and apply migrations to its disposable test database.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 23 static checks passed.');
