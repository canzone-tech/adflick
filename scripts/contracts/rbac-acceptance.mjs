import { hasMysqlMigrationGate } from '../ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`[rbac-acceptance] ${message}`); process.exitCode = 1; };
const requiredFiles = [
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'apps/api/src/campaigns/campaigns.tenant-isolation.spec.ts',
  'apps/api/src/cms/cms.tenant-isolation.spec.ts',
  'apps/api/src/devices/devices.tenant-isolation.spec.ts',
  'apps/api/src/incidents/incidents.tenant-isolation.spec.ts',
  'apps/api/src/payouts/payouts.tenant-isolation.spec.ts',
  'apps/api/src/playback/playback.tenant-isolation.spec.ts',
  '.github/workflows/ci.yml',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing required acceptance artifact: ${file}`);
}
if (process.exitCode) process.exit(process.exitCode);

const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) fail('Prisma provider must remain MySQL.');
const roleCsv = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
const roles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','SCREEN_OWNER','CONTENT_MANAGER','OPERATIONS_MANAGER','FINANCE_MANAGER','SUPPORT_AGENT','AUDITOR_COMPLIANCE'];
for (const role of roles) if (!roleCsv.includes(`\n${role},`)) fail(`Role acceptance row missing: ${role}`);

const testCsv = fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8');
for (const token of ['TEN-001','TEN-002','DEV-002','FIN-001','FIN-004','FIN-006','REL-001']) {
  if (!testCsv.includes(`\n${token},`)) fail(`Critical acceptance scenario missing: ${token}`);
}
if (!/Live transfers stay disabled/i.test(fs.readFileSync(path.join(root, 'docs/BATCH-HISTORY.md'), 'utf8'))) {
  fail('Acceptance document must explicitly keep live transfers disabled until release conditions are met.');
}

const protectedControllers = [
  'apps/api/src/campaigns/campaigns.controller.ts',
  'apps/api/src/cms/cms.controller.ts',
  'apps/api/src/finance/finance.controller.ts',
  'apps/api/src/incidents/incidents.controller.ts',
  'apps/api/src/payouts/payouts.controller.ts',
  'apps/api/src/playback/playback.controller.ts',
  'apps/api/src/devices/devices.controller.ts',
];
let routeCount = 0;
for (const file of protectedControllers) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (!content.includes('JwtAuthGuard') || !content.includes('RolesGuard')) fail(`${file} must contain JWT and role guards for user-facing routes.`);
  if (!content.includes('@Roles(')) fail(`${file} has no explicit role declarations.`);
  routeCount += (content.match(/@(Get|Post|Patch|Put|Delete)\s*\(/g) || []).length;
}
if (routeCount < 40) fail(`Expected broad controller inventory (at least 40 routes), found ${routeCount}.`);

const devices = fs.readFileSync(path.join(root, 'apps/api/src/devices/devices.controller.ts'), 'utf8');
for (const token of ["@Headers('x-device-secret')", "this.devices.heartbeat", "this.devices.deviceCommands", "this.devices.reportCommand"]) {
  if (!devices.includes(token)) fail(`Device-secret endpoint contract missing: ${token}`);
}
const delivery = fs.readFileSync(path.join(root, 'apps/api/src/delivery/delivery.service.ts'), 'utf8');
if (!/secret/i.test(delivery)) fail('Delivery service must retain device secret validation.');
if (!hasMysqlMigrationGate()) fail('CI must use MySQL 8.4 and apply migrations.');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) fail('check:source must invoke check-regression-contracts.mjs.');

if (!process.exitCode) console.log(`Contract rbac-acceptance static acceptance checks passed (${roles.length} roles, ${routeCount} controller routes, 7 protected controller files).`);
