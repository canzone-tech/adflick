import fs from 'node:fs';
import path from 'node:path';
const required = [
  'scripts/verify-dependency-install.mjs',
  'docs/BATCH_48_CLEAN_CI_DEPENDENCY_HARDENING.md',
  'docs/BATCH_48_ACCEPTANCE_MATRIX.csv',
  'BATCH_48_FILE_MANIFEST.txt',
];
for (const file of required) if (!fs.existsSync(path.resolve(file))) {
  console.error(`[BATCH 48] Missing ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
for (const token of ['npm ci --no-audit --no-fund', 'Require reviewed dependency lockfile', 'package-lock.json']) {
  if (!ci.includes(token)) { console.error(`[BATCH 48] CI missing ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['verify:dependencies']?.includes('verify-dependency-install.mjs')) { console.error('[BATCH 48] dependency verifier not wired'); process.exitCode = 1; }
if (!pkg.scripts?.['check:source']?.includes('check-batch48.mjs')) { console.error('[BATCH 48] source checker not wired'); process.exitCode = 1; }
const verifier = fs.readFileSync('scripts/verify-dependency-install.mjs', 'utf8');
for (const token of ['process.versions.node', 'package-lock.json', 'lockfileVersion', 'process.env.CI']) {
 if (!verifier.includes(token)) { console.error(`[BATCH 48] verifier missing ${token}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log('Batch 48 static checks passed: dependency runtime verifier, workspace checks, npm lockfile guard and clean CI install wiring.');
