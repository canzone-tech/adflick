# Batch 28 — Cross-Tenant Persistence E2E Acceptance

## Objective
Extend Batch 27's MySQL-backed HTTP suite from authentication checks into organization-boundary regression tests. The new scenarios use actual Organization A and Organization B records in the configured disposable MySQL database, issue HTTP requests as Organization A, and inspect persisted state after denied writes.

## Implemented scenarios
- Organization A's collection endpoints must not include Organization B fixture IDs for campaigns, media assets, layouts, fleet screens, incidents, and payout batches.
- Cross-tenant campaign update, layout publication, screen status change, incident update, and payout-batch approval attempts must return 404.
- After rejected mutation attempts, the test reads the Organization B rows directly through Prisma and asserts the original values remain unchanged.
- Fixtures are uniquely named and the suite attempts explicit cleanup.

## Run only against disposable MySQL 8.4
```bash
npm ci
npx prisma generate
npm run db:deploy
RUN_MYSQL_SECURITY_E2E=1 npm run test:e2e:security
npm run check:source
```
The suite is enabled only by `RUN_MYSQL_SECURITY_E2E=1`, and it rejects non-MySQL connection strings. Do not set this flag against production or shared staging databases. CI already provisions a dedicated MySQL 8.4 service and enables this suite.

## Scope limitations
These are targeted acceptance tests, not exhaustive proof for every endpoint, every role, every nested resource, or every export. Any newly added controller route must receive a positive and negative authorization test. Database cleanup should be verified on failure paths in CI; disposable CI databases are the final cleanup boundary.

## Release and finance safety
- Device-reported playback is not sufficient proof for billing or owner rewards.
- Reward amounts remain conditional on configured valid-play thresholds, fraud review, eligibility and finance approval.
- Live transfers remain disabled until the actual execution path enforces all release gates and provider, reconciliation, finance, security, and MySQL integration acceptance evidence is approved.
