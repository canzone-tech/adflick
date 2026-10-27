import { hasLockedDependencyGate } from './ci-contract.mjs';
import fs from 'node:fs';

const required = [
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`[BATCH 49] Missing ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
if (!hasLockedDependencyGate()) {
  console.error('[BATCH 49] CI must fail closed without a lockfile and install via npm ci.');
  process.exitCode = 1;
}
if (ci.includes('npm install --package-lock-only')) {
  console.error('[BATCH 49] CI must not generate a temporary lockfile; commit the reviewed lockfile.');
  process.exitCode = 1;
}
if (ci.includes('Prepare dependency lockfile for clean CI install')) {
  console.error('[BATCH 49] Obsolete lockfile-bootstrap step remains in CI.');
  process.exitCode = 1;
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch49.mjs')) {
  console.error('[BATCH 49] check:source is not wired to Batch 49.');
  process.exitCode = 1;
}
const verifier = fs.readFileSync('scripts/verify-dependency-install.mjs', 'utf8');
for (const token of ['process.env.CI', 'package-lock.json', 'lockfileVersion']) {
  if (!verifier.includes(token)) {
    console.error(`[BATCH 49] Dependency verifier missing ${token}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Batch 49 static checks passed: CI fails closed without a committed lockfile and installs only with npm ci.');
