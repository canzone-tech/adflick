# BATCH 19 — Sandbox Provider Integration & Reconciliation Matching

## Scope
Adds a deterministic, in-memory sandbox payout adapter and a pure statement-to-payout matcher. No real payment gateway, bank rail, or beneficiary endpoint is called. This batch is intentionally not a live-money implementation.

## Controls
- Provider adapter accepts INR integer paise only and requires a tokenized beneficiary reference.
- Stable idempotency key returns the same simulated provider reference for an exact retry; changed data with the same key is rejected.
- Adapter explicitly rejects use in production.
- Webhook signatures use HMAC-SHA256 over the exact raw body and constant-time comparison.
- Statement matching checks payout reference, provider reference, integer-paise amount, currency and state conflicts.
- Unknown rows and mismatches are surfaced for manual review; matching is a pure function and does not update ledger/payout states.
- Existing durable event registry from Batch 18 remains the persistence/idempotency layer for production callback ingestion.

## Required next integration work
1. Choose and approve the payment provider and account region.
2. Implement its official sandbox API client with timeouts, TLS, request signing and idempotency.
3. Verify provider-specific callback signature, timestamp window, event identifier and account identifier.
4. Persist callback receipt before asynchronous processing; atomically claim events and apply monotonic state transitions.
5. Re-query provider status after network timeouts instead of blindly retrying a potentially accepted transfer.
6. Import official statements; route all non-matches to a finance review queue.
7. Keep production transfers behind an explicit deployment kill switch and finance approval.

## Acceptance tests
- Same idempotency key + same amount/reference returns same simulated reference.
- Same idempotency key with altered payout data fails.
- Invalid/missing webhook signature fails.
- Modified raw body fails signature verification.
- Unknown payout, amount mismatch, currency mismatch and status conflict are not auto-settled.
- A paid record cannot be downgraded by a stale statement.
- Sandbox adapter cannot run in production.
- Run full API unit tests and MySQL 8.4 integration tests before enabling any real provider.
