# Batch 39 — Durable Reconciliation Import Idempotency

## Changes
- Adds MySQL `ReconciliationImport` with unique key `(organizationId, providerName, idempotencyKey)`.
- Stores a SHA-256 digest of the exact statement payload.
- Adds a provider-neutral reservation helper that uses Prisma's `P2002` unique conflict as the concurrency arbiter, then re-reads the existing row scoped by organization and provider.
- Same key + same payload returns `IN_PROGRESS` while RECEIVED/PROCESSING, or `REPLAY` for terminal/existing states. It must never apply rows again on a replay.
- Same key + different payload returns `PAYLOAD_CONFLICT`.
- If a unique conflict cannot be resolved inside the tenant/provider scope, the helper fails closed.
- Adds unit tests for first reservation, completed replay, changed-payload conflict, in-progress duplicate, and missing scoped row.

## Important implementation boundary
This batch creates the schema, migration, reservation contract and unit tests. It does not wire the helper into an HTTP upload endpoint or implement statement-row persistence/application. Before enabling reconciliation imports in production, wire the store to Prisma, persist each import and its row-level discrepancies transactionally, add an endpoint idempotency key requirement, and add MySQL integration tests for concurrent requests and crash recovery.

## Required acceptance tests
1. Two concurrent same-key/same-payload submissions produce one import row; one caller creates and the other resolves to the existing row.
2. Same key with a different payload is rejected as `PAYLOAD_CONFLICT`.
3. A completed import retry returns replay and does not create new payout state changes.
4. Tenant A cannot discover Tenant B's import by key.
5. A transaction failure rolls back all row applications and import completion status together.
6. Statement import never settles or pays a payout automatically; reviewed matching remains required.
