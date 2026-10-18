import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/finance/reconciliation/reconciliation-import.read.spec.ts',
  'docs/BATCH_44_RECONCILIATION_READ_API.md',
  'docs/BATCH_44_ACCEPTANCE_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) { console.error(`[BATCH 44] Missing ${file}`); process.exitCode = 1; }
if (process.exitCode) process.exit(process.exitCode);
const service = fs.readFileSync(path.join(root, 'apps/api/src/finance/reconciliation/reconciliation-import.service.ts'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'apps/api/src/finance/finance.controller.ts'), 'utf8');
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  "where: { id: importId, organizationId }",
  "where: { importId, organizationId }",
  "take: limit",
  "limit > 200",
  "offset > 100_000",
  'async getImport(',
  'async getImportRows(',
]) if (!service.includes(token)) { console.error(`[BATCH 44] Missing service guard: ${token}`); process.exitCode = 1; }
for (const token of ["@Get('reconciliation-imports/:id')", "@Get('reconciliation-imports/:id/rows')", '@Roles(...FINANCE_READ)']) if (!controller.includes(token)) { console.error(`[BATCH 44] Missing route/role: ${token}`); process.exitCode = 1; }
for (const token of ['hides imports owned by another organization as not found', 'returns paginated rows with organization scope and stable row order', 'rejects unbounded or malformed pagination', 'allows auditor read access but rejects non-finance roles']) if (!test.includes(token)) { console.error(`[BATCH 44] Missing test scenario: ${token}`); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch44.mjs')) { console.error('[BATCH 44] check:source not wired'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 44 static checks passed: tenant-scoped reconciliation read API, bounded pagination and role coverage.');
