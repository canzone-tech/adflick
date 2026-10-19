# ADFLICK — Functional Application Conversion Assessment
**Date:** 2026-10-19  
**Status:** Phase 1 local-development-only implementation OWNER APPROVED (19 October 2026). Business rules, Phase 2–4, staging and production NOT authorized.  
**Inspected repository:** `canzone-tech/adflick` on `dev/local-foundation` at `b69d8b6e81e183990ddf45965bc5eb753881e4e0`

## Decision
**Do not rebuild the repository from scratch.** Reuse the tested NestJS, Prisma/MySQL 8.4 schema/migrations, JWT/session logic, REST controllers, GitHub CI, and compiled runtime pipeline. Replace or connect demo-only Next.js modules incrementally, with authenticated user flows and permanent **development** persistence only after approval. Keep existing non-ADFLICK services completely isolated.

## Verified/reviewed evidence
- The latest exact-SHA Backend CI, Frontend CI, and Release Evidence completed SUCCESS. The user supplied a successful earlier Ubuntu root `npm run verify` and screenshots of the overview, CMS layout, empty playlist and campaign demo pages. Exact local UAT of future changes remains pending.
- Source contains `apps/api/src/auth/auth.controller.ts` (login, refresh, logout, me, change-password), `cms/cms.controller.ts` (asset/layout/playlist list/create/actions) and `campaigns/campaigns.controller.ts` (list/create/review/approval/schedule/lifecycle), with JWT/RBAC guards. These endpoints must undergo end-to-end signed-in UI acceptance before being called complete.
- `apps/web/app/cms/page.tsx` explicitly uses local React state for assets/zones/playlist drafts, with no authenticated save or uploaded media bytes. `apps/web/app/campaigns/page.tsx` seeds hardcoded sample campaigns; its buttons change local state but not the backend.
- `apps/web/app/fleet/page.tsx` is likewise an interactive sample and explicitly states real fleet data requires API integration. Dashboard metrics in `apps/web/app/page.tsx` are engineering/demo indicators, not live MySQL operational data.
- `apps/web/lib/api.ts` already provides an API client and token refresh, but presently keeps tokens in browser localStorage. Production session hardening and CSRF threat modeling are required.
- `scripts/local-runtime.mjs` intentionally spins up a **disposable** MySQL Docker container with no persistent volume; all data is removed when the runtime ends. It does not seed a real user by default. `prisma/seed.ts` has guarded demo-only accounts but must **not** be used for production or automatic commercial data creation.
- Business policies/fees/reward thresholds/provider payment enabling remain unresolved in `docs/BUSINESS-RULES-REGISTER.md`. Historical source recovery Batches 051–101 and actual TV player integration remain separate blockers.

## Conversion delivery plan (sequential; all phases proposed until approved)

### Phase 1 — Reliable isolated development environment and authenticated operator UAT
1. Obtain explicit owner approval before changing local-development infrastructure. Create a dedicated **ADFLICK-only persistent MySQL 8.4 volume**, separate project/container/network and non-conflicting private loopback ports. **Never** operate on unrelated Docker databases, PM2 apps or Apache vhosts.
2. Provide reviewed development-only first-user bootstrap with Argon2, least-privilege role assignment and temporary/local credentials (not hardcoded password and never shipped to production). Protect all secret material.
3. Verify real sign-in, refresh/logout, unauthorized 401, role-based denial, user feedback and data surviving a development process restart.
4. Keep `npm run verify` disposable and authoritative. Persistent developer DB is separate from test DB.

**Acceptance:** Chrome/Ubuntu browser login, logout, session protection, reload persistence, scoped MySQL records, error/loading/empty states and documented CI/log evidence. Do not enable live finance/payment operations.

### Phase 2 — Real CMS and campaign web workflows
1. Replace CMS sample asset/layout/playlist state with typed `apiRequest` integrations, approved DTO validation and scoped list/create/update flows. Distinguish *draft* versus *published/active* without inventing business policy.
2. Add actual media bytes upload only after S3-compatible storage/provider/local-dev storage is selected and approved. Test asset validation, size/content-type, authenticated signed upload and failure recovery.
3. Replace demo campaigns with authenticated API list/create/review/approve/reject/schedule views. Enforce actual backend roles and server state; show 401/403 and no-data states. Do not enable billing or unapproved campaign lifecycle policies.
4. Preserve responsive design system, accessible controls and demonstrate browser actions with real database assertions.

**Acceptance:** Server-side data survives reload/restart, RBAC/tenant isolation and negative tests pass; end-to-end browser UAT with screenshot evidence.

### Phase 3 — Fleet, schedules, playback and reliable playout
Connect devices, player pairing, content assignments, manifests, heartbeat and proof-of-play to approved APIs. Recover missing source batches or implement identified missing features without pretending that demo/simulated TV screens are live physical players. Require test device, offline/recovery, D-pad/remote, L-shape overlays and real platform UAT.

### Phase 4 — Production engineering and independent authorization
Review auth cookie/CSRF model and rate limits, operational metrics/logging, PostgreSQL-free MySQL ledger authority, backup/restore proof, immutable checksum-verified source-free runtime artifacts, scoped rollbacks and real device/provider UAT. Explicit operator/product approval for exact release. No live payouts or product rules invented from prototypes.

## First implementation slice — owner approved 19 October 2026
Owner approved **Phase 1 only**. Implementation adds `scripts/local-dev-db.mjs`, interactive `scripts/local-dev-admin.mjs`, `npm run local:dev:up`, authenticated `/account` logout UI and end-to-end GitHub CI. **No** automatic production transfer, SMTP provider or product policy changes. Phase 2 requires separate approval.

## Reporting / open decisions
- **Current:** technical CI GREEN on inspected SHA; prior user-provided local `npm run verify` PASS; current website is **not** an accepted live application.
- **Unresolved:** owner authorization for a new persistent development-only MySQL volume and development account bootstrap; approved roles/accounts and media storage choice; TV platform/player source; business policy decisions; production infrastructure approval.
- **Not performed by this assessment:** code/UI changes, DB migration in any existing environment, production deployment, payment processing, or changes to unrelated projects.

## Phase 1 developer handoff (read before use)

```bash
# From ~/ADFLICK, after exact-SHA three-CI success has been confirmed:
git pull
npm run verify
npm run local:dev:admin
npm run local:dev:up
```

The one-time admin CLI asks for *organization name*, *display name*, *email*, and a password twice without echoing it. It creates one `ORGANIZATION_ADMIN` with Argon2id password hashing and an audit event, and refuses to change/overwrite an existing user. **Do not** use the demo `prisma db seed` for this process.

`local:dev:up` launches an ADFLICK-owned MySQL 8.4 Docker container and named **persistent volume** with dynamically assigned loopback TCP port, authenticates via ignored root `.adflick-local/db.json` (mode 0600), deploys source migrations, and builds/starts the compiled API and UI on dynamically assigned loopback ports. Browser `/login` now leads to `/account`, which verifies identity using `GET /auth/me` and revokes the server session on logout. Ctrl+C shuts down only the scoped ADFLICK app and the MySQL container it started; the **named volume and data survive** and are reused next launch. Docker Compose, PM2 and the operator's other projects are untouched. `npm run verify` remains isolated and disposable; the two databases never share a volume.

Never commit/share `.adflick-local/db.json`, passwords or token values. Local browser JWT/refresh tokens still use browser localStorage **only as a development prototype**; production-grade HttpOnly/CSRF session design must be independently reviewed. A real Ubuntu browser sign-in, logout, refresh and process-restart check is still user-operator pending even when CI turns green.

## Phase 1 implementation: technical CI GREEN

**Code verification, not operator release sign-off:** [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39239629953), [Frontend CI](https://github.com/canzone-tech/adflick/actions/runs/39239629962), and [Release Evidence](https://github.com/canzone-tech/adflick/actions/runs/39239629943) are all successful on `f157286f691b6b14aeec3b14d76a627a4a0b9405`. Server/API tests prove JWT login, role denial, logout revocation and MySQL stop/restart persistence. Chrome tests prove signed-in account UI/refresh/signout. Phase 1 Ubuntu operator UAT remains pending; Phase 2 CMS/campaign integration not started and requires separate authorization.
