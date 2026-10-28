import fs from 'node:fs';
import path from 'node:path';

const required = [
  'apps/api/src/auth/guards/roles.guard.spec.ts',
  'apps/api/src/auth/tenant-scope.spec.ts',
  'apps/api/src/finance/providers/callback-validation.spec.ts',
  'apps/api/src/finance/release/release-gate.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`[identity-sessions] Missing test or acceptance artifact: ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

const roles = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/auth/guards/roles.guard.spec.ts'), 'utf8');
for (const token of ['allows a user', 'explicitly allowed', 'no authenticated user', 'getAllAndOverride']) {
  if (!roles.includes(token)) {
    console.error(`[identity-sessions] Role guard test coverage missing: ${token}`);
    process.exitCode = 1;
  }
}
const tenant = fs.readFileSync(path.join(process.cwd(), 'apps/api/src/auth/tenant-scope.spec.ts'), 'utf8');
for (const token of ['conflicting organization ID', 'Resource not found.', 'organization context']) {
  if (!tenant.includes(token)) {
    console.error(`[identity-sessions] Tenant helper test coverage missing: ${token}`);
    process.exitCode = 1;
  }
}
const apiPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/api/package.json'), 'utf8'));
const jestConfig = fs.readFileSync('apps/api/jest.config.cjs', 'utf8');
if (!apiPackage.scripts?.test?.includes('--config ./jest.config.cjs') || !jestConfig.includes('testRegex') || !jestConfig.includes('ts-jest')) {
  console.error('[identity-sessions] Jest must discover TypeScript spec files.');
  process.exitCode = 1;
}
const rootPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
if (!rootPackage.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[identity-sessions] check:source must include check-regression-contracts.mjs.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract identity-sessions static checks passed: role guard, tenant scope, callback validation, release gate and Jest discovery.');
