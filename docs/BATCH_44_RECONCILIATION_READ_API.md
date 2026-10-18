# Batch 44 — Reconciliation Read API and End-to-End Verification

## Scope

Batch 44 exposes read-only APIs for finance reconciliation imports and their persisted statement rows. These routes are tenant-scoped and use the existing JWT and role guards.

## Routes

- `GET /api/v1/finance/reconciliation-imports/:id` — import summary, counts, lifecycle timestamps and non-sensitive error code.
- `GET /api/v1/finance/reconciliation-imports/:id/rows?limit=100&offset=0` — paginated reconciliation outcomes. `limit` must be 1–200; `offset` must be 0–100000.

Finance readers include Super Admin, Organization Admin, Finance Manager and Auditor/Compliance. Write endpoints remain restricted to Super Admin, Organization Admin and Finance Manager. A foreign-tenant or missing import returns `404` to avoid revealing that another organization's record exists.

## Data protection and behavior

- Every import and row lookup includes the authenticated `organizationId`.
- Rows are ordered by ascending statement row number for stable pagination.
- The API returns only the stored statement result fields; it does not return the original raw statement payload or payload digest.
- Read endpoints are strictly read-only. They do not mutate payout items, ledger balances, reward calculations or initiate transfers.
- Pagination is bounded to limit response size and avoid unbounded row reads.

## Verification

`apps/api/src/finance/reconciliation/reconciliation-import.read.spec.ts` covers organization-scoped metadata reads, foreign-tenant not-found behavior, row pagination, bounded parameters, auditor read access and advertiser rejection.

Run with installed dependencies:

```bash
npm test -w apps/api -- --runInBand src/finance/reconciliation/reconciliation-import.read.spec.ts
npm run check:source
```

Run the full finance MySQL integration suite separately against a disposable local MySQL 8.4 database with `RUN_MYSQL_FINANCE_E2E=1`. Static checks and unit test source are not proof of a successful database or release build. Live transfers remain disabled until release gates pass.
