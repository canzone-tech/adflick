# Batch 21 — End-to-End QA, Tenant Isolation & Production Acceptance

## Purpose

Add fail-closed tenant-scope helpers and an actionable acceptance plan for ADFLICK PLAYOUT CMS. This batch is a testability and governance increment, not a claim that every existing service has already been refactored or that the system is production certified.

## Added code

- `apps/api/src/auth/tenant-scope.ts`
  - `requireOrganizationId`: rejects absent, null, or blank organization context.
  - `organizationWhere`: merges the authenticated tenant ID into a Prisma-style filter and rejects conflicting tenant filters.
  - `assertSameOrganization`: rejects absent and cross-tenant resources using a non-disclosing not-found error.
- `apps/api/src/auth/tenant-scope.spec.ts`: unit tests for fail-closed behavior, cross-tenant rejection, and input immutability.
- `scripts/check-batch21.mjs`: deterministic source-level guard for required files and project invariants.

**Important integration rule:** these helpers are not magical/global authorization. Every organization-owned service method must use them (or an equivalent reviewed policy) for both list and single-resource operations. Never trust `organizationId` supplied by a browser, player, query parameter, or request body as the authorization source. Platform-wide roles must use explicit, audited exceptions rather than silently bypassing tenant predicates.

## Role and boundary matrix

| Role | Default scope | Required checks |
|---|---|---|
| Super Admin | Platform-wide only when explicitly authorized | MFA, reason/audit record for sensitive access, least privilege |
| Organization Admin | Own organization | Tenant predicate on all organization-owned rows |
| Advertiser | Own advertiser account / organization | Campaign, billing, asset and report ownership |
| Screen Owner | Own owner account and registered devices | Pairing, device ownership, reward eligibility |
| Content Manager | Assigned organization | Asset, playlist, schedule and moderation permissions |
| Operations Manager | Assigned operational scope | Device commands, incident workflow, approval separation |
| Finance Manager | Authorized finance scope | Maker-checker, ledger consistency, reconciliation evidence |
| Support Agent | Assigned cases only | Minimized PII, audited temporary access |
| Auditor/Compliance | Read-only approved scope | Immutable audit trail, export controls |

Actual role enum names and grants must be confirmed against the deployed Prisma schema and authorization decorators before release.

## Mandatory end-to-end acceptance scenarios

### Authentication and tenant boundaries
- [ ] Anonymous requests to protected endpoints are rejected.
- [ ] A user with no organization context cannot perform organization-scoped writes or reads.
- [ ] Organization A cannot list, read, mutate, delete, export, or infer Organization B's campaigns, assets, playlists, screens, playback reports, incidents, payout requests, or disputes.
- [ ] Direct object-ID requests receive a non-disclosing response for cross-tenant resources.
- [ ] Tenant predicates are applied to list queries, detail queries, counts, aggregates, exports, and background jobs.
- [ ] Super Admin cross-tenant access is explicit, separately permissioned, logged, and tested.
- [ ] Organization IDs in request bodies cannot override authenticated identity context.
- [ ] Support impersonation or temporary access (if enabled) is time-limited and audited.

### Playback and advertising
- [ ] Duplicate proof-of-play event IDs are idempotent.
- [ ] Invalid, stale, malformed, or unpaired device events are rejected or quarantined.
- [ ] Device-secret authentication is not treated as cryptographic proof that a physical ad was viewed.
- [ ] Campaign, creative, schedule, device and tenant ownership are cross-checked.
- [ ] Offline playback replay and clock drift are tested.
- [ ] Billing/reward calculations use validated evidence and explicit eligibility policy.

### Finance and provider callbacks
- [ ] Reward calculations create auditable ledger entries and cannot silently mutate posted entries.
- [ ] Maker and checker cannot approve the same sensitive transaction when separation of duties is required.
- [ ] Reconciliation discrepancies remain unresolved until a human-authorized decision is recorded.
- [ ] Reused idempotency keys with changed payloads are rejected.
- [ ] Webhook signature is verified over the exact raw request body before processing.
- [ ] Timestamp window, provider account allowlist, event uniqueness and allowed state transitions are checked.
- [ ] Duplicate, out-of-order, delayed, malformed and replayed callbacks are tested.
- [ ] Live transfers remain disabled unless the production release gate is wired into the actual transfer path and all controls are independently verified.

### Operations, UX and resilience
- [ ] Every menu/action is tested against each role, not only hidden in the UI.
- [ ] API authorization is authoritative; frontend hiding is not a security control.
- [ ] Mobile widths 320, 360, 390, 768, 1024 and desktop are checked for overflow and inaccessible controls.
- [ ] Empty, loading, validation, permission-denied, API failure and session-expired states are reviewed.
- [ ] Device offline/online transitions, retry exhaustion, duplicate commands and stale telemetry are tested.
- [ ] Audit logs include actor, action, target, timestamp, result and correlation ID without secrets or unnecessary PII.

## MySQL 8.4 integration test requirements

Use an isolated disposable MySQL 8.4 test database; never point automated tests at production. Apply migrations from a clean database and test rollback/recovery in a separate disposable environment. Include fixtures for at least two organizations and prove cross-tenant access is denied. Verify uniqueness constraints, foreign keys, transaction boundaries, isolation behavior, and duplicate-event handling. The test suite must fail if the database URL is missing or points at a disallowed production host.

## Release evidence required

- [ ] `npm run check:source`
- [ ] Prisma validation and generated client check
- [ ] API and web type checks, lint, builds
- [ ] API unit tests and MySQL 8.4 integration tests
- [ ] Role-by-role authorization report
- [ ] Two-tenant isolation report for all organization-owned modules
- [ ] Provider sandbox tests, signed callback tests and reconciliation evidence
- [ ] Finance approval and payout release-gate evidence
- [ ] Backup restore drill, monitoring/alert test, incident response owner
- [ ] Security review sign-off and known-issues acceptance
- [ ] Explicit production go/no-go approval

## Current limitations / release status

This batch adds pure helper functions and source-level tests. Existing services are not automatically protected until each service integrates the helpers or equivalent tenant-scoped predicates. The full NestJS/Jest/Prisma/MySQL suite must be run in an environment with dependencies and a disposable MySQL 8.4 instance. Source checks alone do not establish production readiness. Live transfers must stay disabled until the transfer execution path enforces the release gate and finance/provider/security approvals are complete.
