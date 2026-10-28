import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'prisma/schema.prisma',
  'prisma/migrations/202610140039_reconciliation_import_idempotency/migration.sql',
  'apps/api/src/finance/reconciliation/reconciliation-import-idempotency.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import-idempotency.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[reconciliation-import-idempotency] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const schema = fs.readFileSync(path.join(root, required[0]), 'utf8');
const migration = fs.readFileSync(path.join(root, required[1]), 'utf8');
const service = fs.readFileSync(path.join(root, required[2]), 'utf8');
const tests = fs.readFileSync(path.join(root, required[3]), 'utf8');
for (const token of ['model ReconciliationImport', '@@unique([organizationId, providerName, idempotencyKey])', 'ReconciliationImportStatus']) {
  if (!schema.includes(token)) { console.error(`[reconciliation-import-idempotency] Missing Prisma schema token: ${token}`); process.exitCode = 1; }
}
for (const token of ['UNIQUE KEY `ReconciliationImport_org_provider_idempotencyKey_key`', 'FOREIGN KEY (`organizationId`)']) {
  if (!migration.includes(token)) { console.error(`[reconciliation-import-idempotency] Missing MySQL migration guard: ${token}`); process.exitCode = 1; }
}
for (const token of ['PAYLOAD_CONFLICT', 'IN_PROGRESS', 'REPLAY', "code !== 'P2002'", 'organizationId: input.organizationId']) {
  if (!service.includes(token)) { console.error(`[reconciliation-import-idempotency] Missing idempotency behavior: ${token}`); process.exitCode = 1; }
}
for (const token of ['same idempotency key when payload differs', 'does not reprocess an import already in progress', 'fails closed']) {
  if (!tests.includes(token)) { console.error(`[reconciliation-import-idempotency] Missing unit test: ${token}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-import-idempotency] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1; }
if (!process.exitCode) console.log('Contract reconciliation-import-idempotency static checks passed: durable reconciliation import idempotency schema and reservation contract.');
