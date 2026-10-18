import fs from 'node:fs';
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const runner = fs.readFileSync('scripts/verify.mjs', 'utf8');
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
export function usesSharedBackendGate() {
  return ci.includes('npm run verify:backend')
    && rootPkg.scripts?.['verify:backend']?.includes('scripts/verify.mjs');
}
export function hasMysqlMigrationGate() {
  return usesSharedBackendGate() && ci.includes('mysql:8.4')
    && runner.includes("['prisma', 'migrate', 'deploy']")
    && runner.includes('assertDisposableDatabase()');
}
export function hasMysqlSecurityGate() {
  return hasMysqlMigrationGate()
    && ci.includes('RUN_MYSQL_SECURITY_E2E: "1"')
    && runner.includes("['run', 'test:e2e:security']")
    && runner.includes("RUN_MYSQL_SECURITY_E2E: '1'");
}
export function hasLockedDependencyGate() {
  return usesSharedBackendGate()
    && runner.includes("existsSync('package-lock.json')")
    && runner.includes("['ci', '--no-audit', '--no-fund']")
    && runner.includes("['run', 'verify:dependencies']")
    && !ci.includes('npm install --package-lock-only');
}
