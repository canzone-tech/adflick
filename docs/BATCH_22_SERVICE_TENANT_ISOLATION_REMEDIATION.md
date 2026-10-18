# Batch 22 — Service-by-Service Tenant Isolation Remediation

## Scope

This batch follows Batch 21's tenant-scope primitives with defense-in-depth organization predicates on selected existing Prisma mutations. It does not certify every endpoint. The repository must still receive full TypeScript/Jest/MySQL integration validation before deployment.

## Remediations applied

- Campaign mutation paths now include the organization ID in the Prisma unique mutation filter after loading the campaign within the actor's organization: edit, submit, approve, reject, schedule and transition.
- CMS state changes for media assets, layouts and playlists include the organization ID in their mutation filters after a tenant-scoped lookup.
- Incident updates include the actor's organization ID in the mutation filter.
- Finance reward approval transitions include organization scope when updating the reward calculation and approval record.
- Payout batch state changes, payout item reconciliation and finance dispute resolution include organization scope in mutation filters.
- Playlist assignment disable operation includes organization scope.

Prisma's extended unique filters require the ID to remain unique; the additional organization predicate is defense in depth and must be validated against the generated Prisma client.

## Modules reviewed

| Module | Controls observed | Remaining acceptance work |
|---|---|---|
| Campaigns | Organization-scoped reads, creative/screen validation, advertiser visibility filtering, scoped state mutation | Two-tenant E2E tests; association replacement transactionality; verify all workflow endpoints |
| CMS assets/layouts/playlists | Organization-scoped list/get patterns, same-tenant asset checks, scoped mutation filters | Verify upload object authorization and storage keys; trusted media worker must verify object bytes |
| Devices | Organization-scoped fleet operations; device-secret paths authenticate device identity | Test pairing brute-force limits, cross-tenant owner assignment, command replay and device-secret rotation |
| Playlist assignments | Screen and playlist tenant checked before assignment; disable mutation scoped | Test unique upsert behavior and transactionally consistent command creation |
| Playback | Screen secret validation; authorization, asset, campaign and playlist checks tied to screen organization; report query scoped | Test duplicate batches, offline replay, event authorization reuse, MySQL uniqueness and concurrent ingestion |
| Incidents | Organization-scoped list/summary/create; screen and assignee checks; update mutation scoped | Test notification dedupe race and assigned-user permissions |
| Reward finance | Organization-scoped policies, calculations, approvals and ledger reads; approval mutations scoped | Test atomic ledger posting, concurrent decisions, maker-checker and tenant isolation |
| Payouts/disputes | Organization-scoped batch/dispute reads and writes; state and maker-checker checks | Verify every nested payout item query is scoped via batch; run concurrent transition tests; live transfers remain disabled |
| Scheduler/background jobs | Global campaign/device operations are intentional platform jobs | Add explicit service identity, tenant-aware audit and multi-replica locking before horizontal scale |
| Notification outbox | Global worker drains a shared outbox across tenants | Ensure API visibility remains tenant-scoped; test retry/lock recovery and dead-letter monitoring |

## Security rules

1. Derive organization identity from the authenticated user context; never from a body or query parameter alone.
2. Scope both the initial resource lookup and the mutation. A prior lookup is not a reason to omit tenant scope from the write.
3. Scope nested rows through their parent batch/resource and validate the parent belongs to the active organization.
4. Keep device-secret endpoints separate from user-JWT endpoints and bind every device operation to the authenticated screen ID.
5. Do not treat UI role hiding as access control. Enforce role and tenant checks in API services.
6. Keep super-admin access explicit; a missing organization ID must not silently become an unrestricted query.
7. Avoid revealing cross-tenant resource existence. Return a consistent not-found response for inaccessible IDs.
8. Do not activate live payouts based on source checks or sandbox results alone.

## Required tests before release

- [ ] Seed organizations A and B and users for every role in each.
- [ ] Attempt cross-tenant GET, PATCH, POST action, report, export, nested-item update and dispute resolution by direct IDs.
- [ ] Assert no row changes in tenant B after tenant A attempts a write.
- [ ] Assert audit rows use the authenticated actor's organization and never a caller-supplied tenant ID.
- [ ] Run concurrent campaign transitions and finance approvals to verify state guards.
- [ ] Test transaction rollback when audit or ledger posting fails.
- [ ] Test MySQL 8.4 unique constraints and migration from a clean database.
- [ ] Run `npm run verify:release` in a dependency-installed environment with a disposable test database.
- [ ] Obtain security, finance and operations sign-off.

## Known limitations

This increment adds organization predicates to selected mutation filters and a source-level regression checker. It does not automatically wrap all Prisma operations, and no static text scan can prove tenant isolation. Full application tests and a route-by-route two-tenant security test remain mandatory.
