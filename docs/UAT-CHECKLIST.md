# UAT checklist — technical PASS / product sign-off PENDING

- [ ] MySQL 8.4 clean migration from an empty disposable database; upgrade rehearsal from approved prior schema.
- [ ] API compiled process boots: `GET /api/v1/health` 200; `GET /api/v1/ready` 200 with disposable MySQL ready; unauthenticated `GET /api/v1/auth/me` 401.
- [ ] Public dashboard root renders; `/login`, `/cms`, `/fleet`, `/finance` pages return HTML without server error.
- [ ] Auth login/refresh/logout and server-enforced role checks including cross-tenant denial.
- [ ] Campaign creation, approval, schedule, playlist/device sync, offline recovery with expected state transitions.
- [ ] Proof-of-play valid/duplicate/late/malformed/replayed event rejection and reporting.
- [ ] Finance maker-checker, idempotency, concurrency, duplicate import processing, negative cases and no live transfer.
- [ ] TV player: real platform build, D-pad/focus, ad overlay playback, connectivity loss/restart, valid player telemetry.
- [ ] Responsive screenshots and real browser keyboard/touch UAT at target breakpoints.
- [ ] Encrypted off-host backup, isolated restore, scoped rollback, external HTTPS and unrelated service isolation.

Each line requires real test log, reviewer, SHA and PASS/FAIL/BLOCKED. Static source checks alone cannot close a line.

## Ubuntu desktop visual review (user-submitted screenshots, 19 October 2026)

**Partial desktop preview review, not full functional or business UAT.** User submitted four Chrome-on-Ubuntu screenshots: overview, CMS layout editor, CMS playlist tab, and Campaign Management. At the captured desktop size there is **no observed major overlap, blank page, sidebar clipping, or broken canvas rendering**. The 68% main / 32% side zone arrangement is rendered as intended. This visual observation does not establish backend persistence, active devices, stored media, or successful operator login.

**Issues found in screenshots and corroborated in source**:
- Dashboard misleadingly displayed "APPROVED PRODUCT BASELINE", Batch 01 progress/completion cues and seven data models even though the current project is an unapproved development prototype with 18 migrations. Fix: honest development/demo text and removal of hardcoded percentage progress.
- CMS playlist tab could show a **stale Media Library validation message** and a clickable draft-save button when no preview assets were selected. Fix: per-tab context feedback, disabled zero-item draft button, and non-persistence wording.
- Campaigns screen showed sample budgets, approval/activation controls and a new locally-created row that might be mistaken for persisted/real operations. Fix: prominent **above-the-fold "Demo workspace"** disclaimer; no API calls or finance operations introduced.

**Automated follow-up:** [Frontend CI Chrome UAT](https://github.com/canzone-tech/adflick/actions/runs/39218977525) verified 12 rendered routes, Chrome desktop/mobile screenshots, sidebar click, login required-field validation, unauthorized API HTTP 401, CMS tab/asset/playlist interactions, and Campaign draft creation **plus reload non-persistence** on code commit `18089b10cdf0721d6be4bf71edfcab3b3d4e0f06`. CI artifact `adflick-browser-uat` contains screenshots. This test uses isolated disposable MySQL and does not claim physical Ubuntu or Smart TV browser UAT.

**Open:** visual approval of the **updated** UI on the user's own Ubuntu browser, keyboard-only focus and responsive/touch interaction, real authenticated backend save flows, readability of the existing 8–11px prototype metadata, API loading/error UX, screen-player integration, and business/provider approval. User screenshots are intentionally **not committed** because they include desktop/browser chrome and other personal context.


## Phase 1 authenticated local development evidence

- [x] CI-only persistent MySQL 8.4 labeled volume and container ownership; test data survives container stop/restart: [Backend CI 39239629953](https://github.com/canzone-tech/adflick/actions/runs/39239629953)
- [x] CI-only one-time organization admin bootstrap; Argon2; no hardcoded default password; second attempt blocked: same backend run
- [x] Real compiled API login, refresh, logout/session revocation and 401/403 role denial: same backend run
- [x] Chrome signed-in account, refresh, logout, browser tokens cleared and API server 401 after logout: [Frontend CI 39239629962](https://github.com/canzone-tech/adflick/actions/runs/39239629962)
- [ ] **Operator Ubuntu** actual first-admin prompt, local `npm run verify` on new commit, login/logout screenshot and persistence after restart — awaiting user
- [ ] Production cookies/CSRF, backup/restore, product/platform acceptance — not Phase 1 sign-off

## Ubuntu first-admin bootstrap defect — observed 19 October 2026

**Observed:** root local verify SUCCESS; interactive development admin CLI could not access `User` because the persistent owned DB had not applied migrations, and password keystrokes appeared in terminal screenshot. This is not evidence of a successful first account creation or sign-in, and does not imply any fault in the disposable root verifier. No password string or screenshot containing personal terminal context is stored in this repository.

**Engineering action:** auto-run Prisma migrate deploy via shared fail-closed persistent DB preparation before any first-admin query, fully close readline before entering raw TTY password input, and add no-echo/migration-preflight regressions. **Operator local acceptance pending** after final three-CI SHA and retry with a fresh unique secret. No historical migration editing, database deletion, production operation or other-project changes.

## Mandatory client player OS acceptance matrix — 2026-10-29 clarification

**All seven target rows are client-required and NOT yet product-accepted**; see `docs/CLIENT-PLATFORM-SUPPORT.md`. A passed Node web/API CI or a Fleet dropdown is not native player acceptance. The original SRS document's exact OS clause has not been independently re-read; the product owner confirmed these targets explicitly in chat.

| Platform gate | Minimum real evidence | Status |
| --- | --- | --- |
| PLAT-01 Android phone/tablet | Signed Android package, emulator + actual phone/tablet, image/video ad, lifecycle/network recovery and touch UX | **PENDING** |
| PLAT-02 Android TV | Signed TV app, real Android TV devices, D-pad, video codec, 16:9/L-band/safe-area, playback/recovery | **PENDING** |
| PLAT-03 iOS/iPadOS | Signed Apple player build, iPhone/iPad field test, native decoder/storage/network/telemetry | **PENDING** |
| PLAT-04 Samsung Tizen | Tizen app package, real Samsung TV, remote/media/overlay/background and reconnection tests | **PENDING** |
| PLAT-05 LG webOS | webOS app package, real LG TV, remote/media/overlay/background and reconnection tests | **PENDING** |
| PLAT-06 Windows | Signed installer/runtime, representative Windows device, codec/kiosk/reboot/upgrade tests | **PENDING** |
| PLAT-07 Linux | Approved distro/architecture native package, representative Linux device, codec/kiosk/reboot/upgrade tests | **PENDING** |

For **each** platform also verify tenant-scoped pairing, secret storage, revocation, valid/expired signed manifest, independently READY ads, schedule and authorization checks, offline queue, authenticated heartbeat, deduplicated playback events, invalid event rejection, disclosure/fraud rules, signed artifact checksums, reviewer and rollback. Backend event acceptance is **not independent proof-of-view** or payout approval. No platform row can be marked PASS using generic Flutter or Node tests alone.

## Current expanded platform acceptance & local test runbook — 2026-10-29

The historical seven-target section above records an earlier scope checkpoint; the current project owner also requires **Roku TV, Fire TV OS, Titan OS, VIZIO SmartCast, Xumo TV OS and Apple tvOS**. With existing Android TV/Tizen/webOS families this is **nine mandatory TV platforms**, plus Android/iOS mobile and Windows/Linux, tracked as **PLAT-01…PLAT-13**. No real native platform is certified by Node CI or Fleet registration.

**Execute from zero:** `docs/LOCAL-END-TO-END-TEST-PLAN.md` defines P0/P1 disposable local verification; P2 standalone compiled browser UAT; P3 one-time-first-admin-if-needed; P4 persistent dev API/Web; P5 guest/admin/MFA/CMS/Fleet/device protocol; P6 restart persistence; case-ID observations and a redacted evidence template. All **new manual test cases start NOT RUN** on the new plan SHA. Developer `local:dev:uat` is CI-only; native 13-group device UAT remains separately pending. Original SRS product approvals and production authorization are unchanged.
