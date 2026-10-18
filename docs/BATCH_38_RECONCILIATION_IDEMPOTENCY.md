# Batch 38 — Reconciliation Idempotency and Provider Reference Safety

## Scope

This batch hardens the pure provider-statement matcher against repeated provider transaction references within a single import. A provider reference must not be associated with two different payout references in the same statement. Exact duplicate provider/payout pairs remain flagged as `REFERENCE_MISMATCH`; they are never treated as a second successful settlement.

## Behavior

- Match remains a review result only; it does not mutate a payout, wallet, or ledger.
- A repeated provider reference assigned to a different payout is rejected with `REFERENCE_MISMATCH`.
- An exact duplicate provider/payout pair in the same import is rejected.
- Amount and currency are still compared exactly (currency case-insensitively; amount in paise).
- Existing paid/reversed terminal-state protections remain in force.
- Provider statement retries across separate import requests still require a durable import-idempotency key and database uniqueness constraint at the persistence layer. This pure matcher does not claim to provide cross-request deduplication.

## Required integration acceptance

1. Import the same statement twice and verify a durable import identifier prevents duplicate application.
2. Attempt to reuse a provider transaction reference for another payout and verify a persisted discrepancy is created, not a ledger update.
3. Inject a failure during persistence and verify the transaction rolls back.
4. Verify a reviewed result is tenant-scoped and an audit record is persisted atomically with any approved state transition.
5. Keep automated settlement and live transfers disabled unless provider, finance, and release gates are satisfied.

## Validation limitation

Static source checks verify that the expected guard and tests exist. They do not prove that the application persists import idempotency correctly; database-backed integration tests are still required.
