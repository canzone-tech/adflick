# Batch 29 — Concurrency and Export Boundary Hardening

## Delivered
- Added unit tests for payout approval's conditional state transition: a stale/concurrent update that affects zero rows must raise `ConflictException` and must not write an approval audit.
- Added a maker-checker test proving the batch creator cannot approve their own batch.
- Added a positive-path test asserting the audit is written after the conditional state transition succeeds.
- Added an operational test matrix covering nested resource IDs, tenant-scoped export behavior, duplicate playback races and finance concurrency.
- Added a static source checker and included it in `npm run check:source`.

## Finance safety property
The service uses a conditional update scoped by `id`, `organizationId`, and `PENDING_APPROVAL`; exactly one changed row is required. This is a source-level concurrency guard, not a claim that a live MySQL concurrency test has passed. Export returns a provider-neutral payload and does not itself invoke a payment provider. Live money movement remains disabled pending all release gates.

## Test matrix
Run on a disposable MySQL 8.4 database for HTTP/database scenarios and run Jest for unit tests:
```bash
npm ci
npx prisma generate
npm run db:deploy
npm test
RUN_MYSQL_SECURITY_E2E=1 npm run test:e2e:security
npm run check:source
```
Review all failed test cleanup paths and use CI's disposable database only. Do not enable the E2E flag against production or shared staging.

## Additional scenarios to implement in subsequent batches
- Nested campaign creative, playlist assignment and screen command endpoints must reject cross-organization resource IDs.
- Export and report payloads must be verified to contain only rows belonging to the authenticated organization.
- Concurrent identical playback event submissions must create no more than one persisted event for a `(screenId, eventId)` pair; duplicate or replayed events must never count toward reward eligibility.
- Execute parallel payout decision and reconciliation requests against MySQL, asserting only one legal state transition commits.
