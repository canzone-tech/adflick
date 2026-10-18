# Batch 32 — Concurrency and finance acceptance hardening

## Delivered in source

1. Added a focused playback authorization single-consumption race unit test. Two distinct completed-event IDs may both validate the same one-use authorization, but only one conditional `updateMany(... consumedAt: null ...)` may win. A loser is changed to `REJECTED`, receives `PLAYBACK_AUTHORIZATION_ALREADY_CONSUMED`, and is not counted for eligibility.
2. Hardened the payout export read path: nested payout items are filtered by the authenticated `organizationId`; the export transition updates only items matching both batch ID and organization ID.
3. Added a Batch 32 source acceptance checker and security matrix.

## Required execution before release

Run from repository root after installing dependencies and provisioning a **disposable MySQL 8.4 database**:

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run check:source
npm run test:api -w apps/api -- --runInBand
RUN_MYSQL_SECURITY_E2E=1 DATABASE_URL='mysql://...' JWT_ACCESS_SECRET='at-least-32-characters-long-test-secret' npm run test:e2e:security
```

The last command runs the existing MySQL-backed HTTP security suite. The new authorization-consumption race test is a mocked unit test, not a claim of a real database concurrency test. Do not represent source checks as proof that MySQL race behavior has been exercised. For database-level race acceptance, add a disposable-MySQL test that sends concurrent ingestion requests for the same authorization and verifies one eligible completion, one rejected completion, one consumed grant, and persisted event rows.

## Payout acceptance checks

- Export is limited to the caller's organization and only independently approved batches.
- Returned items are selected from the database with both `payoutBatchId` and `organizationId` predicates.
- Export transition item updates use both organization and batch predicates.
- Export creates an audit event in the same transaction as the status transition.
- Concurrent approval must produce one conditional state transition and at most one approval audit event; Batch 29 covers the conditional-update unit contract.
- Reconciliation concurrency still requires a MySQL-backed test. Do not assume the current read/validate/write flow is race-proof solely because it is transactional; review conditional item/batch state predicates and terminal-state handling before enabling provider transfers.

## Safety boundary

This batch does not enable live transfers, issue bank instructions, or treat device-reported playback alone as proof of payable performance. Reward eligibility remains subject to configurable campaign/device targets, fraud checks, owner/KYC/tax review, finance approval, and reconciliation.
