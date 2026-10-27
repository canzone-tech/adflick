import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/finance-transaction.mysql.e2e-spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 36] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ["startsWith('mysql://')", "rejects.toThrow()", 'SUBMITTED_TO_PROVIDER', 'BATCH_36_TRANSACTION_COMMITTED', 'localhost']) {
  if (!test.includes(token)) { console.error(`[BATCH 36] Missing integration safety/assertion: ${token}`); process.exitCode = 1; }
}
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const apiPkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'));
if (!rootPkg.scripts?.['check:source']?.includes('check-batch36.mjs')) { console.error('[BATCH 36] check:source must include check-batch36.mjs.'); process.exitCode = 1; }
if (!rootPkg.scripts?.['test:e2e:finance'] || !apiPkg.scripts?.['test:e2e:finance']) { console.error('[BATCH 36] Finance integration test scripts are missing.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 36 static checks passed: opt-in MySQL transaction atomicity integration coverage.');
