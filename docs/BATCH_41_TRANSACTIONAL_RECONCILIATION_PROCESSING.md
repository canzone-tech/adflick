# Batch 41 — Transactional Reconciliation Processing

## Added
- Adds `ReconciliationImportRow` to Prisma and a MySQL 8.4 migration.
- Adds `POST /api/v1/finance/reconciliation-imports/process`.
- Reuses the Batch 39/40 durable import reservation. Only a newly-created reservation is processed; an existing key returns replay/in-progress/conflict and is never re-applied.
- Parses the CSV with the existing strict parser and matches payout references against payout item IDs within the authenticated organization.
- Persists each statement row's match/discrepancy outcome and marks the import `COMPLETED` in the same Prisma transaction.
- Failed processing attempts transition a still-RECEIVED import to `FAILED` where possible.
- The import processor does not update payout items, wallet balances, reward ledger entries, or trigger transfers.

## API
`POST /api/v1/finance/reconciliation-imports/process`

Requires the existing JWT + roles guards and one of Super Admin, Organization Admin, Finance Manager. The authenticated organization is authoritative. Request body contains `providerName`, `idempotencyKey`, and `payload`.

The `payoutReference` in the statement CSV must identify the payout item ID. Provider transaction reference, amount in paise, currency and status are compared against the stored payout item.

## Atomicity boundary
Row results and the `COMPLETED` status update are in one database transaction. If either write fails, both should roll back. A separate best-effort failure marker changes a still-RECEIVED import to FAILED after processing errors; it is not part of the failed transaction.

## Not yet production-complete
- Add MySQL 8.4 integration tests for rollback and simultaneous requests.
- Review handling of very large statements and pagination/streaming.
- Add a UI for discrepancy review and an audited, maker-checker settlement workflow.
- Do not apply imported `PAID`/`FAILED` statuses to payout items automatically.
- Live bank transfers remain disabled.
