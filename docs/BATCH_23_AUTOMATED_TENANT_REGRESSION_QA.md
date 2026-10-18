# Batch 23 — Automated Tenant Regression QA

## Purpose

Batch 23 introduces service-level Jest regression specs that verify a cross-tenant direct-ID request is rejected before a write or transaction is started. These tests exercise the service boundary with mocked Prisma calls; they are not a replacement for a live MySQL integration or HTTP end-to-end test.

## Added regression specs

- `apps/api/src/campaigns/campaigns.tenant-isolation.spec.ts`
  - Cross-tenant campaign update returns not-found and never calls the mutation.
  - Missing organization context prevents the campaign lookup.
- `apps/api/src/incidents/incidents.tenant-isolation.spec.ts`
  - Cross-tenant incident update returns not-found and does not write or audit.
- `apps/api/src/payouts/payouts.tenant-isolation.spec.ts`
  - Cross-tenant dispute resolution returns not-found before opening a transaction.
  - Missing organization context fails closed for payout listing.
- `apps/api/package.json`
  - Explicit Jest/ts-jest configuration to discover `*.spec.ts` files.

## Run tests

From the project root in an environment with Node.js 22+, npm dependencies, and a generated Prisma client:

```bash
npm install
npx prisma generate
npm run test:api -- --runInBand
npm run check:source
```

For database migration validation against a disposable MySQL 8.4 instance:

```bash
DATABASE_URL='mysql://test_user:test_password@127.0.0.1:3306/adflick_test' npx prisma migrate deploy
```

Use only a dedicated test database. Never run test migrations or fixtures against production.

## Required live MySQL and HTTP tests still outstanding

1. Seed two independent organizations with resources and users.
2. Exercise protected endpoints using valid JWTs for each organization.
3. Assert HTTP response and persisted database state for cross-tenant direct-ID requests.
4. Test list, detail, update, delete, nested records, aggregate/report, export and background-job boundaries.
5. Test transactional rollback, concurrent finance approval, duplicate playback ingestion and provider callback replay.
6. Capture CI logs and a database-backed test report before release.

## Test status in this source package

Static checks are run during archive preparation. Jest was not run during package creation because dependencies are not installed in the source environment. Therefore the new specs are included but remain unexecuted here. Production readiness is not asserted.
