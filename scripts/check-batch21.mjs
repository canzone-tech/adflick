import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/auth/tenant-scope.ts',
  'apps/api/src/auth/tenant-scope.spec.ts',
  'docs/BATCH_21_E2E_TENANT_ISOLATION_PRODUCTION_ACCEPTANCE.md',
  'docs/BATCH_21_ROLE_PERMISSION_REGRESSION_MATRIX.csv',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing Batch 21 file: ${file}`);
    process.exitCode = 1;
  }
}
const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) {
  console.error('Prisma provider must remain MySQL.');
  process.exitCode = 1;
}
const helper = fs.readFileSync(path.join(process.cwd(), required[0]), 'utf8');
for (const token of ['requireOrganizationId', 'organizationWhere', 'assertSameOrganization', 'TenantScopeError']) {
  if (!helper.includes(token)) {
    console.error(`Tenant-scope helper missing ${token}`);
    process.exitCode = 1;
  }
}
const test = fs.readFileSync(path.join(process.cwd(), required[1]), 'utf8');
for (const token of ['conflicting tenant predicate', 'cross-tenant', 'does not mutate']) {
  if (!test.includes(token)) {
    console.error(`Tenant-scope regression test missing scenario: ${token}`);
    process.exitCode = 1;
  }
}
const docs = fs.readFileSync(path.join(process.cwd(), required[2]), 'utf8');
for (const token of ['MySQL 8.4', 'Live transfers remain disabled', 'Tenant predicates']) {
  if (!docs.includes(token)) {
    console.error(`Acceptance document missing required control: ${token}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Batch 21 static checks passed.');
