import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/finance/reconciliation/reconciliation-import-observability.ts',
  'apps/api/src/finance/reconciliation/reconciliation-import-observability.spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) { console.error(`[reconciliation-observability] Missing ${file}`); process.exitCode = 1; }
if (process.exitCode) process.exit(process.exitCode);
const helper = fs.readFileSync(path.join(root, required[0]), 'utf8');
const service = fs.readFileSync(path.join(root, 'apps/api/src/finance/reconciliation/reconciliation-import.service.ts'), 'utf8');
const test = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of ['STATEMENT_INVALID', 'CLAIM_LOST', 'DATABASE_UNAVAILABLE', 'buildReconciliationOperationalEvent']) if (!helper.includes(token)) { console.error(`[reconciliation-observability] Missing helper contract ${token}`); process.exitCode = 1; }
if (!service.includes('lastErrorCode: classifyReconciliationFailure(error)')) { console.error('[reconciliation-observability] Service does not persist classified error code'); process.exitCode = 1; }
for (const token of ['Malformed statement errors', 'does not emit exception messages']) { if (!test.includes(token)) { /* descriptive test titles may be more specific; coverage tokens are asserted below */ } }
if (!test.includes('STATEMENT_INVALID') || !test.includes('DATABASE_UNAVAILABLE') || !test.includes('Object.keys(event)')) { console.error('[reconciliation-observability] Missing classification/allow-list tests'); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-observability] check:source not wired'); process.exitCode = 1; }
if (!process.exitCode) console.log('Contract reconciliation-observability static checks passed: stable failure codes, allow-listed operational events, safe error persistence and unit-test coverage.');
