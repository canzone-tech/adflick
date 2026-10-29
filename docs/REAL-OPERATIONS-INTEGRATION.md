# ADFLICK — real operational API integration (development-only)

## Scope and isolation

The public engineering dashboard and existing `/cms`, `/campaigns`, and `/fleet` browser-only previews are preserved. New visually separated **SECURED API / LIVE TENANT DATA** panels appear on each page. They check `/auth/me` first, hide real records from guests and unrelated roles, and use existing server-enforced JWT, organization scoping, RBAC, and MFA step-up. No new schema, business compensation rules, production infrastructure, or provider activation.

## Five implementation/acceptance tracks

1. **CMS media** — tenant-scoped `GET /cms/assets`; browser file upload uses existing `POST /cms/assets` presigned S3 PUT and SHA-256 `POST /cms/assets/:id/complete-upload` flow. Requires real object-storage configuration and CORS; absence must show an error, never a fake completion. Server marks assets PROCESSING; trusted worker validation to READY is not implemented or claimed.
2. **CMS layout and playlist drafts** — canvas percentages map into existing 1920×1080 draft zone DTO on explicit Save; stored layouts reload from `GET /cms/layouts`. Playlist DRAFT requires a real same-organization READY asset, positive duration, and `POST /cms/playlists`. No publish, activation or assignment is automatic.
3. **Campaigns** — existing tenant-scoped `GET /campaigns`; explicit DRAFT creation requiring a READY creative, and submit-for-review, with no approval, targeting, scheduling, advertising delivery or money movement. Server REST boundary converts Prisma `budgetPaise` BigInt to lossless decimal strings instead of failing JSON serialization. No fabricated demo budget is posted.
4. **Fleet** — `GET /fleet/screens` and `GET /fleet/health-summary`; explicit register via `POST /fleet/screens`. Actual generated pairing code is shown only until dismissed/reloaded; list records never reveal it. No device secret, physical player action, remote command or automatic pairing is initiated.
5. **QA** — isolated disposable MySQL REST test covers authenticated 401/403, tenant scopes, READY media, layout/playlist drafts, campaign exact minor-unit serialization and review transition, secure hashed pairing code, and absence of financial ledger entries. Actual Chrome checks guest isolation, staff real-record loading, persisted layout/screen after reload, one-time pairing code dismissal, and no campaign creation without independently READY creative; existing mobile/keyboard suites remain intact.

## Gaps / release blockers

- Real S3-compatible storage and its browser CORS, independently verified media READY worker, SmartTV/player pairing, physical-device L-shape/replay proof, real campaign playback, and sponsor/placement rules require separate implementation/UAT.
- Campaign approval and scheduling are deliberately not exposed as new real-panel actions; business/legal/financial/provider decisions remain unapproved.
- No published marketing homepage, provider-approved SMS, binary commission calculation or payout functionality is enabled. Only explicit release approval and production recovery/rollback evidence can authorize deployment.
- Source code is committed on `dev/local-foundation`. Exact-SHA CI and user-run `npm run verify` remain mandatory before any further deployment planning.

## Bootstrap administrator has no tenant context

The initial provisioned first-admin account may carry `ORGANIZATION_ADMIN` without an `organizationId`. Such a session is **not** allowed to assume arbitrary tenant access. Real CMS, Campaign and Fleet panels now check both role **and** selected organization before making record requests, present an explicit organization-context-required message, and show no tenant inventory. Chrome first-admin UAT asserts this safe-denial path. MySQL REST E2E tests independently verify tenant-scoped create/read/persistence using explicitly provisioned isolated organizations; Chrome write-and-reload checks run only when the browser account actually has an organization context. No implicit tenant creation, impersonation, or scope elevation is introduced.
