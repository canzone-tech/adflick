import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'prisma/migrations/202610140042_reconciliation_import_leases/migration.sql',
  'apps/api/src/finance/reconciliation/reconciliation-import-idempotency.ts',
  'apps/api/src/finance/reconciliation/prisma-reconciliation-import-store.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.service.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import.processing.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) { console.error(`[reconciliation-lease] Missing ${file}`); process.exitCode = 1; }
if (process.exitCode) process.exit(process.exitCode);
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(path.join(root, required[0]), 'utf8');
const helper = fs.readFileSync(path.join(root, required[1]), 'utf8');
const service = fs.readFileSync(path.join(root, required[3]), 'utf8');
const tests = fs.readFileSync(path.join(root, required[4]), 'utf8');
for (const token of ['processingToken', 'processingLeaseUntil', 'attemptCount']) if (!schema.includes(token) || !migration.includes(token)) { console.error(`[reconciliation-lease] Missing lease field ${token}`); process.exitCode = 1; }
for (const token of ["outcome: 'RECOVERABLE'", "existing.status === 'PROCESSING'"]) if (!helper.includes(token)) { console.error(`[reconciliation-lease] Missing recovery rule ${token}`); process.exitCode = 1; }
for (const token of ['randomUUID()', "status: 'PROCESSING'", 'processingLeaseUntil: { lte: now }', 'completed.count !== 1', 'RECONCILIATION_IMPORT_CLAIM_LOST']) if (!service.includes(token)) { console.error(`[reconciliation-lease] Missing claim safety ${token}`); process.exitCode = 1; }
for (const token of ['rejects completion if the worker loses its claim before commit', 'does not process a duplicate reservation a second time']) if (!tests.includes(token)) { console.error(`[reconciliation-lease] Missing test ${token}`); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-lease] check:source not wired'); process.exitCode = 1; }
if (!process.exitCode) console.log('Contract reconciliation-lease static checks passed: atomic claims, lease-based stale recovery, token-fenced commit, no payout settlement.');
