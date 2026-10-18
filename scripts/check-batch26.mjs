import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/auth/guards/roles.guard.spec.ts',
  'apps/api/src/auth/tenant-scope.spec.ts',
  'apps/api/src/finance/providers/callback-validation.spec.ts',
  'apps/api/src/finance/release/release-gate.spec.ts',
  'docs/BATCH_26_AUTHORIZATION_TEST_EXECUTION.md',
  'docs/BATCH_25_SECURITY_ACCEPTANCE_TEST_MATRIX.csv',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`[BATCH 26] Missing test or acceptance artifact: ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

const roles = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/auth/guards/roles.guard.spec.ts'), 'utf8');
for (const token of ['allows a user', 'explicitly allowed', 'no authenticated user', 'getAllAndOverride']) {
  if (!roles.includes(token)) {
    console.error(`[BATCH 26] Role guard test coverage missing: ${token}`);
    process.exitCode = 1;
  }
}
const tenant = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/auth/tenant-scope.spec.ts'), 'utf8');
for (const token of ['conflicting organization ID', 'Resource not found.', 'organization context']) {
  if (!tenant.includes(token)) {
    console.error(`[BATCH 26] Tenant helper test coverage missing: ${token}`);
    process.exitCode = 1;
  }
}
const apiPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/api/package.json'), 'utf8'));
const jestConfig = fs.readFileSync('apps/api/jest.config.cjs', 'utf8');
if (!apiPackage.scripts?.test?.includes('--config ./jest.config.cjs') || !jestConfig.includes('testRegex') || !jestConfig.includes('ts-jest')) {
  console.error('[BATCH 26] Jest must discover TypeScript spec files.');
  process.exitCode = 1;
}
const rootPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
if (!rootPackage.scripts?.['check:source']?.includes('check-batch26.mjs')) {
  console.error('[BATCH 26] check:source must include check-batch26.mjs.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Batch 26 static checks passed: role guard, tenant scope, callback validation, release gate and Jest discovery.');
