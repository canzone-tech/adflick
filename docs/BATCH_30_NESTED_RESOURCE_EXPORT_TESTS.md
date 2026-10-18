# Batch 30 — Nested Resource & Export Tenant Tests

## Implemented
- Campaign update tests assert that foreign-organization creative assets and screen targets are rejected by the service's organization-scoped lookup before association writes.
- Payout export test asserts that a batch from another organization is looked up with both the requested ID and authenticated `organizationId`, returns not found, and never starts the export transaction.
- Added a security matrix for nested resource IDs, tenant-bound exports, duplicate playback submissions and concurrent payout decisions.
- Added `scripts/check-batch30.mjs` to the cumulative static source check.

## Run in CI / local disposable environment
```bash
npm ci
npx prisma generate
npm run db:deploy
npm test
RUN_MYSQL_SECURITY_E2E=1 npm run test:e2e:security
npm run check:source
```
These new unit tests have not been executed in this environment because dependencies are not installed. Run the commands against a disposable MySQL 8.4 database; never enable the database E2E flag against production.

## Important distinctions
- The tests verify service behavior through mocked Prisma calls, not a live MySQL isolation test.
- The existing playback event unique key `(screenId, eventId)` and P2002 duplicate handling should be tested under actual concurrent MySQL requests before being treated as race-tested.
- Export payload tenant isolation is tested at the service lookup boundary; full HTTP response/download verification remains a follow-up.
- Live transfers remain disabled until release-gate enforcement and provider/finance/security acceptance are complete.
