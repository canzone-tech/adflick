#!/usr/bin/env node
// Source-level regression contracts retained from the audited recovery baseline.
// This is a supplemental gate: unit, MySQL HTTP tests and production smoke remain authoritative.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_CONTRACT_GROUPS = [
  {
    "name": "Finance, reward and provider integrity",
    "checks": [
      "scripts/contracts/finance-accrual.mjs",
      "scripts/contracts/payout-approval.mjs",
      "scripts/contracts/payout-dispute.mjs",
      "scripts/contracts/provider-webhook.mjs",
      "scripts/contracts/release-approval.mjs"
    ]
  },
  {
    "name": "Authorization and tenant security",
    "checks": [
      "scripts/contracts/authorization-roles.mjs",
      "scripts/contracts/tenant-boundaries.mjs",
      "scripts/contracts/security-http.mjs",
      "scripts/contracts/transaction-integrity.mjs",
      "scripts/contracts/rbac-acceptance.mjs",
      "scripts/contracts/identity-sessions.mjs",
      "scripts/contracts/security-e2e.mjs",
      "scripts/contracts/tenant-persistence.mjs"
    ]
  },
  {
    "name": "Idempotency and payout safety",
    "checks": [
      "scripts/contracts/payout-concurrency.mjs",
      "scripts/contracts/nested-tenant-access.mjs",
      "scripts/contracts/playback-idempotency.mjs",
      "scripts/contracts/authorization-consumption.mjs",
      "scripts/contracts/reconciliation-terminal-state.mjs",
      "scripts/contracts/payout-state-transition.mjs",
      "scripts/contracts/reconciliation-audit.mjs"
    ]
  },
  {
    "name": "MySQL reconciliation controls",
    "checks": [
      "scripts/contracts/finance-transactions.mjs",
      "scripts/contracts/reconciliation-concurrency.mjs",
      "scripts/contracts/reconciliation-reference.mjs",
      "scripts/contracts/reconciliation-import-idempotency.mjs",
      "scripts/contracts/reconciliation-import-api.mjs",
      "scripts/contracts/reconciliation-import-rows.mjs",
      "scripts/contracts/reconciliation-lease.mjs",
      "scripts/contracts/reconciliation-mysql.mjs",
      "scripts/contracts/reconciliation-read-api.mjs",
      "scripts/contracts/reconciliation-http.mjs",
      "scripts/contracts/reconciliation-observability.mjs"
    ]
  },
  {
    "name": "Release and dependency hygiene",
    "checks": [
      "scripts/contracts/reconciliation-release.mjs",
      "scripts/contracts/dependency-runtime.mjs",
      "scripts/contracts/lockfile-install.mjs",
      "scripts/contracts/clean-release.mjs"
    ]
  }
];

export function runSourceContracts({
  cwd = process.cwd(), fileExists = existsSync, run = spawnSync,
  report = (message) => console.log(message),
} = {}) {
  let executed = 0;
  const seen = new Set();
  for (const group of SOURCE_CONTRACT_GROUPS) {
    for (const relative of group.checks) {
      if (seen.has(relative)) throw new Error('Duplicate source contract: ' + relative);
      seen.add(relative);
      const file = resolve(cwd, relative);
      if (!fileExists(file)) throw new Error('Missing source regression contract: ' + relative);
      const result = run(process.execPath, [file], {
        cwd, encoding: 'utf8', shell: false, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      });
      if (result.error || result.status !== 0) {
        const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
        throw new Error('Source contract failed: ' + relative + ' (exit=' + (result.status ?? 'unknown') + ')\n' + detail);
      }
      executed++;
    }
    report('PASS: ' + group.name + ' (' + group.checks.length + ' source contracts)');
  }
  return executed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const count = runSourceContracts();
    console.log('PASS: ' + count + ' source regression contracts; full runtime tests run separately.');
  } catch (error) {
    console.error('FAIL: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
