import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/finance/finance.controller.ts',
  'apps/api/src/finance/finance.module.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.service.ts',
  'apps/api/src/finance/reconciliation/prisma-reconciliation-import-store.ts',
  'apps/api/src/finance/dto/reserve-reconciliation-import.dto.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.service.spec.ts',
  'prisma/migrations/202610140039_reconciliation_import_idempotency/migration.sql',
  'docs/BATCH_40_RECONCILIATION_IMPORT_ENDPOINT.md',
  'docs/BATCH_40_ACCEPTANCE_MATRIX.csv',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[BATCH 40] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const controller = fs.readFileSync(path.join(root, required[0]), 'utf8');
const module = fs.readFileSync(path.join(root, required[1]), 'utf8');
const service = fs.readFileSync(path.join(root, required[2]), 'utf8');
const store = fs.readFileSync(path.join(root, required[3]), 'utf8');
const dto = fs.readFileSync(path.join(root, required[4]), 'utf8');
for (const token of ["@Post('reconciliation-imports/reserve')", 'ReconciliationImportService']) {
  if (!controller.includes(token)) { console.error(`[BATCH 40] Missing controller integration: ${token}`); process.exitCode = 1; }
}
for (const token of ['ReconciliationImportService', 'PrismaReconciliationImportStore']) {
  if (!module.includes(token)) { console.error(`[BATCH 40] Missing provider registration: ${token}`); process.exitCode = 1; }
}
for (const token of ['actor.organizationId', 'actor.sub', 'IMPORT_ROLES', 'PAYLOAD_CONFLICT', 'IN_PROGRESS']) {
  if (!service.includes(token)) { console.error(`[BATCH 40] Missing service guard: ${token}`); process.exitCode = 1; }
}
for (const token of ['organizationId: input.organizationId', 'idempotencyKey: input.idempotencyKey']) {
  if (!store.includes(token)) { console.error(`[BATCH 40] Missing tenant-scoped lookup: ${token}`); process.exitCode = 1; }
}
for (const token of ['@Length(1, 10000000)', 'idempotencyKey']) {
  if (!dto.includes(token)) { console.error(`[BATCH 40] Missing DTO validation: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-batch40.mjs')) { console.error('[BATCH 40] check:source must include check-batch40.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Batch 40 static checks passed: authenticated reconciliation import reservation endpoint and tenant-scoped Prisma store.');
