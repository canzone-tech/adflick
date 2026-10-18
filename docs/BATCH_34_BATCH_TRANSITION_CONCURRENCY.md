# Batch 34 — Payout Batch Transition Concurrency

## Objective
Prevent stale payout reconciliation requests from overwriting a batch-level state transition that committed concurrently.

## Change
- Reconciliation still conditionally updates each item, binding item ID, payout batch ID, organization ID, and non-terminal status.
- After reading the transaction's organization-scoped payout items, the service now conditionally transitions the batch only while its persisted status is one of `SUBMITTED_TO_PROVIDER`, `RECONCILIATION_REQUIRED`, or `PARTIALLY_RECONCILED`.
- The batch update uses `updateMany` and requires exactly one affected row. A zero-row result raises `ConflictException`; the enclosing Prisma transaction must roll back item writes and any audit writes.
- The reconciliation audit is created only after both item updates and the conditional batch transition succeed.
- The final batch read remains organization-scoped.

## Regression tests
`apps/api/src/payouts/payouts.reconcile-concurrency.spec.ts` covers a stale item write, organization-scoped item reads, a lost batch-transition race, and audit creation only after a successful conditional transition.

## Acceptance criteria
1. A stale item write fails closed and does not create a success audit.
2. A batch transition affecting zero rows raises a conflict.
3. The production transaction must roll back all prior item updates if the batch transition fails.
4. Audit creation follows successful conditional state transitions and shares the same transaction.
5. Every payout item and batch mutation remains organization-scoped.

## Validation status
The static source checker validates the expected source predicates and test assertions. Run Jest and the MySQL 8.4 integration suite in CI before release; static checks do not prove transaction isolation or rollback against a live database.
