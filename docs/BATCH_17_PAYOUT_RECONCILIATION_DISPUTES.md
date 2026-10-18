# BATCH 17 — Payout Reconciliation, Disputes & Financial Audit

## Objective

Provide a provider-neutral control workflow for taking previously approved reward ledger accruals through payout preparation, independent approval, export, manual/provider submission recording, reconciliation and dispute handling. **This batch does not call a payment gateway, create a bank transfer, or claim money was paid merely because an item was exported or submitted.**

## New schema

- `PayoutBatch`: batch reference, amount/count snapshot, maker/checker fields, provider reference and workflow status.
- `PayoutItem`: unique ledger entry assignment, owner ID, paise amount, compliance-review attestations, provider reference and reconciliation state.
- `FinanceDispute`: reason, description, lifecycle, resolution note and audit timestamps.
- MySQL migration: `prisma/migrations/202610140017_payout_reconciliation_disputes/migration.sql`.

## API endpoints (JWT + role guard + organization context)

- `GET /api/v1/finance/payout-batches`
- `POST /api/v1/finance/payout-batches` — requires ledger entry IDs and explicit identity/KYC/fraud/tax review flags for every item.
- `POST /api/v1/finance/payout-batches/:id/request-approval`
- `POST /api/v1/finance/payout-batches/:id/decision` — APPROVED/REJECTED; batch creator cannot approve own batch. Rejection returns the batch to draft with the decision note retained, allowing controlled resubmission.
- `POST /api/v1/finance/payout-batches/:id/export` — returns provider-neutral payout payload, no transfer.
- `POST /api/v1/finance/payout-batches/:id/submit` — records an externally performed provider submission and reference only.
- `POST /api/v1/finance/payout-batches/:id/reconcile` — records provider results per item; PAID requires a provider transaction reference.
- `GET /api/v1/finance/disputes`
- `POST /api/v1/finance/disputes`
- `POST /api/v1/finance/disputes/:id/resolve`

## Core controls

1. Only positive `REWARD_ACCRUAL` entries tied to `APPROVED` reward calculations can enter a batch.
2. Each ledger entry can be assigned to at most one payout item (`PayoutItem.ledgerEntryId` unique).
3. Every item requires explicit owner identity, KYC, fraud and tax review attestations. These booleans are attestations, not integrations with KYC/tax providers; verify evidence outside this workflow until those integrations are built.
4. Open or under-review disputes prevent a ledger entry from entering a new payout batch and block reconciliation for affected items. Opening a dispute changes unsettled payout items to `DISPUTED`.
5. A batch maker cannot approve their own batch. Approval and state changes are audited.
6. Export and provider submission do not mark any item paid. Reconciliation is separate and PAID requires a provider transaction reference.
7. Terminal paid/reversed payout items cannot be overwritten by a later reconciliation request.
8. Amounts remain integer paise and currency defaults to INR.

## Workflow

`Approved reward ledger -> compliance checks -> draft batch -> independent approval -> export -> externally submit -> import/record provider outcomes -> reconcile -> close disputes`

The batch currently accepts reconciliation outcomes as a JSON API request. A signed provider callback, encrypted statement upload/parser, bank account tokenization, beneficiary KYC verification, provider idempotency API, refund/reversal posting and automatic ledger balancing are not implemented. Never store full bank account numbers or credentials in payout metadata.

## Roles

Read: Super Admin, Organization Admin, Finance Manager, Auditor/Compliance. Write: Super Admin, Organization Admin, Finance Manager. Organization scoping is enforced in service queries. Auditors are read-only.

## Production acceptance gates

- Validate schema with Prisma CLI and generate client.
- Apply migration to disposable MySQL 8.4 and verify foreign keys/indexes.
- Run API unit/integration tests including cross-organization access, duplicate ledger entry, maker-checker, unresolved dispute, failed/held provider result, duplicate reconciliation, and PAID without provider reference.
- Add provider-specific signed statement/callback validation and idempotency before live provider connection.
- Obtain finance/legal approval for KYC, tax, consent, dispute timelines, privacy retention, reconciliation and payment authorization policies.
