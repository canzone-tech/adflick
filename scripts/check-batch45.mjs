import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/reconciliation-import.http.e2e-spec.ts',
  'docs/BATCH_45_RECONCILIATION_HTTP_E2E.md',
  'docs/BATCH_45_ACCEPTANCE_MATRIX.csv',
  'BATCH_45_FILE_MANIFEST.txt',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 45] Missing ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  'RUN_MYSQL_FINANCE_E2E',
  'DATABASE_URL?.startsWith(\'mysql://\')',
  'Refusing non-local database',
  'requires authentication for reconciliation detail and rows endpoints',
  'returns persisted import totals and discrepancy rows through the real HTTP API',
  'allows auditor read access but blocks advertiser access to finance reads and writes',
  'returns not found for foreign-tenant import detail and rows',
  'rejects invalid pagination and confirms the persisted source rows remain unchanged',
  "'/api/v1/finance/reconciliation-imports/process'",
]) if (!test.includes(token)) { console.error(`[BATCH 45] Missing HTTP E2E coverage: ${token}`); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const apiPkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch45.mjs')) { console.error('[BATCH 45] check:source not wired'); process.exitCode = 1; }
if (!apiPkg.scripts?.['test:e2e:finance']?.includes('reconciliation-import.http.e2e-spec.ts')) { console.error('[BATCH 45] finance E2E script not wired'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 45 static checks passed: authenticated reconciliation HTTP E2E, tenant isolation, role access and pagination scenarios.');
