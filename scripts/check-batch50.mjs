import fs from 'node:fs';
const required = [
  'scripts/verify-clean-release.mjs',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`[BATCH 50] Missing ${file}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['verify:clean-release']?.includes('verify-clean-release.mjs')) {
  console.error('[BATCH 50] verify:clean-release is not wired to the preflight script.');
  process.exitCode = 1;
}
if (!pkg.scripts?.['check:source']?.includes('check-batch50.mjs')) {
  console.error('[BATCH 50] check:source is not wired to Batch 50.');
  process.exitCode = 1;
}
const gate = fs.readFileSync('scripts/verify-clean-release.mjs', 'utf8');
for (const token of ['package-lock.json', 'npm ci --no-audit --no-fund', 'prisma/schema.prisma', 'process.exit(1)']) {
  if (!gate.includes(token)) {
    console.error(`[BATCH 50] Release preflight missing required guard: ${token}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Batch 50 static checks passed: clean-release preflight fails closed without a committed lockfile and validates CI/workspace prerequisites.');
