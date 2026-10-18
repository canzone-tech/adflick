# BATCH 18 — Payment Provider Integration & Reconciliation Automation

## Scope
Batch 18 introduces safe integration boundaries, not a live money-transfer integration. It adds a provider adapter contract, HMAC-SHA256 webhook verification against the exact raw request body, payload hashing, a MySQL idempotency registry for provider event IDs, and a strict reconciliation CSV parser.

## Database
Migration: `prisma/migrations/202610140018_provider_webhook_idempotency/migration.sql`.
`ProviderWebhookEvent` stores provider/event identifiers, a SHA-256 payload hash, processing status, attempt count, timestamps and a sanitized error code. It intentionally does not store webhook secrets or raw payloads. The unique `(providerName, providerEventId)` constraint is the durable duplicate-delivery guard.

## Security rules
- Verify webhook signatures against the original raw bytes before JSON parsing.
- Compare signatures using constant-time comparison and reject missing/malformed signatures.
- Enforce provider timestamp freshness and replay policy in the provider-specific controller before processing. HMAC alone does not prevent replay.
- Persist event receipt idempotently before side effects; use a transaction/outbox for resulting payout state changes.
- Never log API keys, webhook secrets, beneficiary data, full raw webhook bodies or bank account data.
- Use opaque beneficiary tokens, TLS, secret-manager storage, strict provider host allowlists and outbound network restrictions.
- Keep live transfer calls disabled until the provider is chosen, its sandbox is tested, signatures and idempotency are verified, and Finance signs off.

## Statement import
Expected CSV columns: `providerReference,payoutReference,amountPaise,currency,status`; optional `occurredAt`. Amounts are integer paise, currency is an ISO-style three-letter code, and statuses are `PAID`, `FAILED`, or `PENDING`. Duplicate provider/payout reference pairs and malformed values are rejected. This parser does not itself reconcile a row to a ledger item: service-level matching must also compare payout reference, amount, currency, current status and organization, and send mismatches to a review queue.

## Provider adapter contract
`apps/api/src/finance/providers/provider-safety.ts` defines `PayoutProviderAdapter`. A concrete adapter must:
1. map an approved payout to provider-specific request fields;
2. use a stable, unique idempotency key derived from the internal payout item;
3. handle timeouts as an unknown result, then query provider status rather than blindly resubmitting;
4. verify signed callbacks and persist event IDs uniquely;
5. map provider statuses conservatively; only verified provider evidence can mark a payout paid;
6. retain provider references and a sanitized audit trail.

## Acceptance checklist
- Verify valid, invalid, missing and stale webhook signatures.
- Replay the same provider event repeatedly; only one business side effect is permitted.
- Test concurrent event delivery against the unique constraint.
- Test timeout-after-provider-acceptance and status-query recovery.
- Test CSV duplicate rows, malformed quotes, invalid amounts, amount/currency mismatch and unknown payout references.
- Test provider statement discrepancy queues, failed transfer retries, reversal and dispute behavior.
- Run Prisma validation/client generation, TypeScript, Jest and MySQL 8.4 migration tests before enabling any provider credentials.

## Explicit non-goals
No live provider is selected or wired, no beneficiary account data is collected, and no payout is sent by this batch. Do not enable production transfers until a provider-specific adapter and end-to-end acceptance suite are approved.
