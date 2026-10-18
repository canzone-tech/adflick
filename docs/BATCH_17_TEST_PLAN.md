# BATCH 17 Test Plan

## Static / schema
- Prisma datasource must remain `mysql`.
- `PayoutItem.ledgerEntryId` must be unique.
- `PayoutBatch`, `PayoutItem`, `FinanceDispute` must exist in schema and migration.
- Payouts module must be registered in `AppModule`.
- All write endpoints must require JWT and role guard.

## Required API tests
1. Reject payout batch if any compliance attestation is false.
2. Reject non-accrual, zero/negative, unapproved, cross-organization or already assigned ledger entries.
3. Reject duplicate ledger IDs in one batch.
4. Reject approval by batch creator; allow a different authorized finance user.
5. Reject export before independent approval.
6. Export must not mark item PAID or invoke a provider.
7. Reject provider submission before export.
8. Reject reconciliation for a different batch's item.
9. Reject PAID reconciliation without provider transaction reference.
10. Reject attempts to overwrite PAID/REVERSED items.
11. Open dispute blocks payout preparation and marks unsettled payout item DISPUTED.
12. Reject duplicate active dispute and prevent cross-organization reads/writes.
13. Verify all decisions and state transitions create audit events.
14. Test concurrent approval/submission requests for compare-and-set state checks.

## Execution status

Static assertions and archive integrity checks are executed during packaging. Prisma validation, TypeScript build, Jest and live MySQL integration tests must be run in CI with dependencies installed; do not infer those tests passed from static checks.
