# Batch 43 — MySQL 8.4 reconciliation import integration coverage

## Purpose

Add opt-in database integration coverage for Batch 42's import lease claims and transactional reconciliation persistence. Tests are gated by `RUN_MYSQL_FINANCE_E2E=1`, require `DATABASE_URL` to use `mysql://`, and refuse any host other than `localhost` or `127.0.0.1`. Run only against a disposable MySQL 8.4 database after applying migrations.

## Scenarios

1. Concurrent conditional claims of one `RECEIVED` import have exactly one winner.
2. Concurrent recovery of an expired `PROCESSING` lease has exactly one winner; stale claim completion causes transaction rollback.
3. A failed completion compare-and-set rolls back row persistence and aggregate counters.
4. Foreign-tenant claim/read/completion predicates affect no rows.
5. Matched and discrepancy rows and counters persist atomically without any payout settlement operation.

## Run

```bash
npm install --no-audit --no-fund
npx prisma validate
npx prisma generate
npx prisma migrate deploy
RUN_MYSQL_FINANCE_E2E=1 DATABASE_URL='mysql://user:password@127.0.0.1:3306/disposable_test_db' npm run test:e2e:finance
```

The repository CI workflow already provisions MySQL 8.4, applies all migrations, and enables `RUN_MYSQL_FINANCE_E2E=1`; the finance command now includes both finance transaction and reconciliation import suites.

## Limits

These tests exercise database primitives and transaction semantics, not a full HTTP request through the controller. They do not prove payment-provider settlement, payout eligibility, fraud detection, or live transfer safety. Payouts remain disabled pending full release gates and provider sandbox certification.
