import { hasMysqlSecurityGate } from './ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'apps/api/test/security.e2e-spec.ts',
  'docs/BATCH-HISTORY.md',
  'scripts/check-batch27.mjs',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`[BATCH 27] Missing required file: ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

const e2e = fs.readFileSync(path.join(root, 'apps/api/test/security.e2e-spec.ts'), 'utf8');
for (const token of [
  "RUN_MYSQL_SECURITY_E2E === '1'",
  "startsWith('mysql://')",
  "get('/api/v1/access/admin-check')",
  ".expect(401)",
  ".expect(403)",
  "revokedAt: new Date()",
  "prisma.organization.create",
  "prisma.user.create",
]) {
  if (!e2e.includes(token)) {
    console.error(`[BATCH 27] E2E suite missing guard/assertion: ${token}`);
    process.exitCode = 1;
  }
}
const apiPkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'));
if (!apiPkg.scripts?.['test:e2e:security']?.includes('security.e2e-spec.ts')) {
  console.error('[BATCH 27] API package must expose test:e2e:security.');
  process.exitCode = 1;
}
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!rootPkg.scripts?.['test:e2e:security'] || !rootPkg.scripts?.['check:source']?.includes('check-batch27.mjs')) {
  console.error('[BATCH 27] Root scripts must expose security E2E and source checks.');
  process.exitCode = 1;
}
if (!hasMysqlSecurityGate()) {
  console.error('[BATCH 27] CI must enable and run the MySQL security E2E suite against MySQL 8.4.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 27 static checks passed: MySQL-gated HTTP E2E, authentication, role denial, session revocation, CI wiring.');
