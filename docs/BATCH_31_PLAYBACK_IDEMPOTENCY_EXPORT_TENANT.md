# Batch 31 — Playback Idempotency & Tenant-Safe Export

## Implemented
- Added playback service unit tests for already-persisted duplicate event IDs, unique-key race conflicts, reward-ineligibility of duplicate results, and invalid device credentials.
- Tightened payout export reads: the initial batch include filters items by the authenticated organization, and the transaction's payout-item query now filters by both `payoutBatchId` and `organizationId`.
- Updated the export boundary test to assert tenant-scoped nested items.
- Added a batch-specific static checker and security acceptance matrix.

## Playback idempotency invariant
The database's unique constraint on `(screenId, eventId)` remains the final concurrency boundary. When Prisma reports `P2002`, ingestion returns `DUPLICATE` and `countedForEligibility: false`. The tests use mocks and do not establish real MySQL concurrency behavior; the database-backed concurrency scenario remains required in CI.

## Validation commands
```bash
npm ci
npx prisma generate
npm run db:deploy
npm test
RUN_MYSQL_SECURITY_E2E=1 npm run test:e2e:security
npm run check:source
```
Use only a disposable MySQL 8.4 database for database-backed E2E tests. Dependencies and live database execution were not available in the source-generation environment.

## Finance safety
The payout export is provider-neutral data only. It does not execute a bank transfer. Live transfers remain disabled until the production release gate, provider integration, reconciliation, finance approval and security checks are enforced and accepted.
