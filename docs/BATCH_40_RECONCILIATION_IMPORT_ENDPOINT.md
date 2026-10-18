# Batch 40 — Reconciliation Import Reservation Endpoint

## Endpoint
`POST /api/v1/finance/reconciliation-imports/reserve`

The existing finance controller is protected by JWT and role guards. This route is restricted to Super Admin, Organization Admin, and Finance Manager roles. It requires an authenticated organization context and validates provider name, idempotency key, and payload size.

## Behavior
- Uses the Batch 39 `ReconciliationImport` unique constraint `(organizationId, providerName, idempotencyKey)` as the concurrency arbiter.
- Persists only the SHA-256 digest, not the raw statement payload.
- Uses the authenticated user's subject as `createdById`; never accepts organization or actor IDs from the request body.
- Identical keys with different payloads return HTTP 409.
- A duplicate request for an import in `RECEIVED`/`PROCESSING` returns HTTP 409 with `RECONCILIATION_IMPORT_IN_PROGRESS`.
- Completed/other existing records return a replay result and must not be re-applied.
- Database reads are scoped by organization, provider, and idempotency key.
- This route reserves an import id only. It does not parse rows, update payouts, create ledger entries, or trigger payments.

## Remaining production work
A later batch must connect the reservation to durable row-level discrepancy storage and transactional processing, add MySQL integration tests for concurrent HTTP requests and recovery, and enforce reviewed-only settlement. The current endpoint must not be described as a complete reconciliation importer.

## Safety
Live transfers remain disabled. Do not automatically settle or pay from imported statement rows.
