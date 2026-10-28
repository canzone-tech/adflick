import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/test/reconciliation-import.mysql.e2e-spec.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) { console.error(`[reconciliation-mysql] Missing ${file}`); process.exitCode = 1; }
if (process.exitCode) process.exit(process.exitCode);
const test = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of [
  'exactly one concurrent worker to claim a RECEIVED import',
  'expired lease and rejects stale workers at commit',
  'rolls back persisted discrepancy rows and counters if completion fails',
  'enforces tenant scope on claim, row reads and import completion',
  'persists matched and discrepancy outcomes without changing payout items or transferring funds',
  "startsWith('mysql://')",
  "includes('127.0.0.1')",
  'BATCH43_STALE_CLAIM',
  'BATCH43_COMPLETION_CAS_FAILED',
]) if (!test.includes(token)) { console.error(`[reconciliation-mysql] Missing integration guard/scenario: ${token}`); process.exitCode = 1; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8'));
if (!pkg.scripts?.['test:e2e:finance']?.includes('test/reconciliation-import.mysql.e2e-spec.ts')) { console.error('[reconciliation-mysql] Finance integration suite not wired'); process.exitCode = 1; }
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!rootPkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) { console.error('[reconciliation-mysql] check:source not wired'); process.exitCode = 1; }
if (!process.exitCode) console.log('Contract reconciliation-mysql static checks passed: MySQL-only integration guards, concurrency, rollback, tenant isolation and discrepancy persistence.');
