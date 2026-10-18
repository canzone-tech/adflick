# Batch 36 — MySQL Finance Transaction Atomicity

## Scope

Adds opt-in integration coverage for the database property required by finance workflows: payout batch state changes and their audit event must commit or roll back together. The suite uses the project's MySQL-only Prisma schema and refuses a non-MySQL or non-local `DATABASE_URL`.

## Tests

- `apps/api/test/finance-transaction.mysql.e2e-spec.ts`
  - Deliberately triggers an audit foreign-key failure after a payout batch update, then verifies MySQL rolled back the status change and did not persist an audit row.
  - Verifies a successful transaction persists both the state change and audit event.
- Enable with `RUN_MYSQL_FINANCE_E2E=1` against a disposable local MySQL 8.4 database after migrations are applied.
- Run using `npm run test:e2e:finance`.

## Safety

This integration suite creates and deletes uniquely named fixture rows. It refuses database URLs that do not point to `localhost` or `127.0.0.1`; use a disposable local database only. It does not call any payment provider and does not enable live payouts.

## Acceptance criteria

1. Forced audit insert failure leaves the batch in `SUBMITTED_TO_PROVIDER` and creates no failure-test audit row.
2. Successful transaction persists `RECONCILIATION_REQUIRED` and exactly one matching audit row.
3. The suite is explicitly opt-in and remains separate from mock-based unit tests.

## Execution status

Source and CI wiring are delivered in Batch 36. The integration tests must be run in an environment with installed dependencies, generated Prisma client, and migrated MySQL 8.4; source checks alone are not evidence that the database tests passed.
