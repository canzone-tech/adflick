# Batch 24 — Authorization Coverage Expansion

## Changes

Batch 24 expands service-level tenant-boundary regression coverage to CMS, devices and playback reporting. It also fixes a missing tenant predicate in the device status mutation.

### Device status mutation fix

`DevicesService.setScreenStatus` previously performed a tenant-scoped `findFirst` and then updated by `id` only. It now uses both `id` and the authenticated `organizationId` in the mutation predicate. The prior scoped lookup remains necessary; the scoped write is defense in depth.

### New regression specs

- `apps/api/src/cms/cms.tenant-isolation.spec.ts`: a cross-tenant layout cannot be published and does not cause a mutation or audit write.
- `apps/api/src/devices/devices.tenant-isolation.spec.ts`: a cross-tenant screen status change is rejected before mutation; a successful update must include organization scope in the write predicate.
- `apps/api/src/playback/playback.tenant-isolation.spec.ts`: screen-specific playback reports retain the authenticated organization predicate and missing organization context fails before database access.

These are mocked service-level Jest tests. They do not prove HTTP guards, database constraints, real Prisma behavior or storage authorization.

## Authorization coverage map

| Module | Coverage added in Batch 24 | Required next step |
|---|---|---|
| Campaigns | Existing Batch 23 direct-ID mutation rejection test | Exercise every workflow action with real HTTP/JWT and MySQL |
| Incidents | Existing Batch 23 cross-tenant update rejection | Test list, summary, assignment, notification and race behavior |
| Payouts | Existing Batch 23 dispute resolution isolation | Add database-backed concurrency and transactional rollback tests |
| CMS | Cross-tenant layout publication rejected | Test assets, playlist associations, signed URLs and object-storage policy |
| Devices | Cross-tenant status change rejected; scoped mutation assertion | Test pairing, heartbeat, command result, owner binding and secret rotation |
| Playback | Screen-specific report tenant predicate | Test device identity, duplicate ingestion, replay, retention and report aggregates |
| Finance | Existing reward approval/provider tests | Test atomic ledger writes, duplicate decisions and tenant isolation on all nested records |
| Scheduler | Existing assignment scoping patterns | Test concurrent workers, tenant-aware locks and duplicate command suppression |

## How to run

From the repository root after installing dependencies and generating the Prisma client:

```bash
npm install
npx prisma generate
npm run test:api -- --runInBand
npm run check:source
```

The repository CI workflow uses a disposable MySQL 8.4 service and runs Prisma migrations before type checks and tests. This workflow must complete successfully before its results can be treated as release evidence.

## Remaining blockers

- No service-level test was executed in this packaging environment because `node_modules` is absent.
- A mock of Prisma calls verifies expected query shape, not database enforcement.
- A route-by-route authorization inventory and HTTP integration tests are still needed.
- Existing single-ID mutations elsewhere may remain insufficiently scoped; continue reviewing all write paths.
- Keep live transfers disabled until the production release gate is enforced in the actual transfer execution path and security/finance acceptance is signed.
