# Batch 33 — Payout Reconciliation Race Hardening

## Objective
Prevent stale reconciliation requests from overwriting terminal payout outcomes and close tenant-scope gaps in the provider-submission and reconciliation reads.

## Changes
- Reconciliation item writes now use a conditional `updateMany` predicate scoped by item ID, payout batch ID, and organization ID.
- The conditional predicate excludes `PAID` and `REVERSED` rows. If another transaction changed the item first, the update count is not exactly one and the transaction raises a conflict; no success audit is written.
- The final payout-item read used to derive the batch status is scoped by both payout batch ID and organization ID.
- Provider-submission updates scope payout items by batch, organization, and expected prior status.
- Added unit coverage for a stale reconciliation race and organization-scoped final reads.

## Validation and limitations
Run `npm run check:source` for static acceptance checks and `npm run test:api` with dependencies installed for Jest execution. The unit tests use mocked Prisma calls; they do not prove real MySQL isolation or lock behavior. Before production, add/run a MySQL 8.4 integration test with two independent transactions racing the same payout item, and confirm that a `PAID`/`REVERSED` terminal state cannot be downgraded. Keep live transfers disabled until provider, finance, security, and release gates pass.
