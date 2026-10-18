# Batch 37 — MySQL Concurrent Reconciliation Acceptance

## Goal
Prove with a disposable MySQL 8.4 database that conditional payout state transitions are single-winner under concurrent requests and that audit persistence follows the transaction outcome.

## Implemented integration scenario
- The test starts from the persisted `RECONCILIATION_REQUIRED` state created by the Batch 36 success case.
- Two independent Prisma transactions both attempt a compare-and-set update with the same expected state.
- Each transaction writes its own audit action only after its conditional update affects exactly one row.
- Exactly one transaction must commit; the other must conflict or fail due to the concurrent state change.
- The final batch state must be `PARTIALLY_RECONCILED`, and exactly one winner audit must be persisted.

## Execution
Run only against a disposable local MySQL 8.4 database after migrations:

```bash
RUN_MYSQL_FINANCE_E2E=1 npm run test:e2e:finance
```

The suite rejects non-MySQL URLs and non-local hosts. Do not point this test at production or a shared environment.

## Important boundaries
- This test validates a database compare-and-set pattern, not every HTTP reconciliation path.
- A deadlock/transaction failure may reject the losing transaction; the test asserts one committed winner and one loser, not a specific engine error string.
- CI is configured to run the test, but it is only considered verified after the CI job actually passes.
- Live bank/payment transfers remain disabled until all provider, security, finance and release gates pass.
