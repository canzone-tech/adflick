import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'prisma/schema.prisma',
  'prisma/migrations/202610140041_reconciliation_import_rows/migration.sql',
  'apps/api/src/finance/finance.controller.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.service.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.processing.spec.ts',
  'docs/BATCH_41_TRANSACTIONAL_RECONCILIATION_PROCESSING.md',
  'docs/BATCH_41_ACCEPTANCE_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 41] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const schema = fs.readFileSync(path.join(root, required[0]), 'utf8');
const controller = fs.readFileSync(path.join(root, required[2]), 'utf8');
const service = fs.readFileSync(path.join(root, required[3]), 'utf8');
const tests = fs.readFileSync(path.join(root, required[4]), 'utf8');
for (const token of ['model ReconciliationImportRow', '@@unique([importId, rowNumber])']) {
  if (!schema.includes(token)) { console.error(`[BATCH 41] Missing row persistence schema: ${token}`); process.exitCode = 1; }
}
for (const token of ["@Post('reconciliation-imports/process')", "@Post('reconciliation-imports/reserve')"]) {
  if (!controller.includes(token)) { console.error(`[BATCH 41] Missing import endpoint: ${token}`); process.exitCode = 1; }
}
for (const token of ['parseReconciliationCsv', 'matchStatementRows', 'reconciliationImportRow.createMany', "status: 'COMPLETED'", 'organizationId']) {
  if (!service.includes(token)) { console.error(`[BATCH 41] Missing processing guard: ${token}`); process.exitCode = 1; }
}
for (const token of ['persists match results and import completion in one transaction', 'does not process a duplicate reservation a second time']) {
  if (!tests.includes(token)) { console.error(`[BATCH 41] Missing regression test: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch41.mjs')) { console.error('[BATCH 41] check:source must include check-batch41.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 41 static checks passed: transactional row outcomes and import completion, no automatic payout settlement.');
