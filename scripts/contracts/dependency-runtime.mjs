import { hasLockedDependencyGate } from '../ci-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
const required = [
  'scripts/verify-dependency-install.mjs',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.resolve(file))) {
  console.error(`[dependency-runtime] Missing ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
if (!hasLockedDependencyGate()) { console.error('[dependency-runtime] CI must retain locked npm ci through the shared backend verifier.'); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['verify:dependencies']?.includes('verify-dependency-install.mjs')) { console.error('[dependency-runtime] dependency verifier not wired'); process.exitCode = 1; }
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[dependency-runtime] source checker not wired'); process.exitCode = 1; }
const verifier = fs.readFileSync('scripts/verify-dependency-install.mjs', 'utf8');
for (const token of ['process.versions.node', 'package-lock.json', 'lockfileVersion', 'process.env.CI']) {
 if (!verifier.includes(token)) { console.error(`[dependency-runtime] verifier missing ${token}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log('Contract dependency-runtime static checks passed: dependency runtime verifier, workspace checks, npm lockfile guard and clean CI install wiring.');
