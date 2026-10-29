# ADFLICK — local end-to-end UAT test plan (start from zero)

**Created:** 2026-10-29. **Project only:** `canzone-tech/adflick`, branch `dev/local-foundation`. **Source assessed:** commit `335a3cae76b965fef74f355befda0c587615f510`. This plan is **READY TO EXECUTE, not UAT PASS**. The owner previously reported `npm run verify` PASS and matching SHA for that source revision. When this document is committed, a **new** exact-SHA Backend CI + Frontend CI + Release Evidence and a **new user-confirmed local gate** are necessary before claiming the documentation commit accepted.

## A. Test boundary and safety

This plan covers public, staff and member Next.js routes, NestJS/MySQL 8.4 identity/MFA/RBAC, CMS/campaign/Fleet workflows, persistent development data, versioned device protocol, signed-manifest/playback authorization, security failures, browser responsive/accessibility checks and physical device gates. **Root `npm run verify` is authoritative automation; it is not complete manual operator or TV/device UAT.**

Prerequisites: Ubuntu test machine, Git, **Node.js 24**, npm 10+, Docker Engine/Desktop running and Chrome/Chromium for standalone browser UAT. Work from repository root, on `dev/local-foundation`. Use fake organization/test data (`example.test`), no real customer PII or payment data.

**Never:** touch production/VPS, other projects' Docker containers/databases, reset an existing dev DB, run `docker compose down -v`, `docker volume prune`, `prisma migrate reset`, paste passwords/TOTP/pairing codes/device secrets/cookies, or commit unredacted personal screenshots/logs. If ownership/branch/CI SHA differs, **STOP**. Create bug fixes directly in GitHub and repeat the exact-SHA gates before proceeding.

**Database separation:** `npm run verify` and `npm run local:uat` use isolated disposable MySQL, removed at end; `npm run local:dev:admin` and `npm run local:dev:up` use an ADFLICK-only **persistent** MySQL volume. Persistent developer data survives restarts and must never be deleted as a workaround.

## B. Operator execution sequence (in exact order)

| Phase | Command/operation from repo root | Expected outcome / safety boundary |
| --- | --- | --- |
| 0. Source/env | `git status --short`; `git branch --show-current`; `git rev-parse HEAD`; `node -v`; `npm -v`; `docker info` | Confirm clean/understood worktree, `dev/local-foundation`, Node 24, npm 10+ and healthy Docker; do not discard unrelated local changes. |
| 1. Authoritative gate | **After 3× CI GREEN on latest SHA only:** `git pull`; `npm run verify`; `git rev-parse HEAD` | Final output `Verification PASS: --all`; SHA equals the currently reviewed CI commit. This runs clean install, source/security/integration, MySQL migrations, compiled API/Web smokes. |
| 2. Automated real browser | `npm run local:uat` | Compiled, disposable API/MySQL/Web and local headless Chrome; `ADFLICK BROWSER UAT PASS`; evidence `.adflick-uat/results.json`/screenshots (redact before sharing). Chrome/Chromium required. |
| 3. First administrator | **If no existing local organization/admin:** `npm run local:dev:admin` | One-time terminal prompts for fake org/name/email and hidden strong password; `ORGANIZATION_ADMIN` only. If one already exists **SKIP**; do not recreate/reset. |
| 4. Persistent local application | `npm run local:dev:up` in **Terminal A**, keep running | `ADFLICK LOCAL READY`; prints Dashboard, Login, CMS and API health URLs on **random 127.0.0.1 ports**. Copy actual printed URLs; do not assume 3000/4000. |
| 5. Manual Ubuntu Chrome + API | Open printed browser URL, execute section C case IDs and record outputs | Guest + authenticated real MySQL UI, no fake PASS for demo panels; use Terminal B for read-only HTTP checks. |
| 6. Persistence/restart | Stop Terminal A with Ctrl+C, then start `npm run local:dev:up` again | Only ADFLICK app services stop; MySQL persistent volume intact; drafts/screens survive. Ports may change. |
| 7. Evidence/review | Consolidate PASS/FAIL/BLOCKED/NOT RUN, exact commit, tested URL (no tokens), sanitized logs | No production release authorization. |

**Do not run `npm run verify` or `npm run local:uat` concurrently with `local:dev:up`**, because they rebuild compiled files in the same checkout. Run `local:dev:admin` before the long-running dev server because it opens/stops its owned database. The command `npm run local:dev:uat` is **CI-ONLY**, not for manual Ubuntu operator use.

### Terminal B — safe unauthenticated HTTP smoke

The Terminal A output contains `API health: http://127.0.0.1:<printed-port>/api/v1/health`. Substitute that **actual** port locally:

```bash
API_BASE='http://127.0.0.1:YOUR_PRINTED_PORT/api/v1'
curl -i "$API_BASE/health"      # expect 200
curl -i "$API_BASE/ready"       # expect 200 with database ready
curl -i "$API_BASE/auth/me"     # expect 401 without cookies
```

These are read-only examples. **Never point them at production or expose credentials in command output.**

## C. Manual case register (initial status = NOT RUN)

| ID | What to do | Expected evidence/result |
| --- | --- | --- |
| ENV-01 | Validate branch/SHA/versions; P1 `npm run verify` | Exact-SHA `Verification PASS: --all`, sanitized log; otherwise FAIL |
| ENV-02 | P2 `npm run local:uat` | Automated Chrome reports PASS, local ignored `.adflick-uat` evidence; or real FAIL/BLOCKED |
| ENV-03 | P3/P4 local first-admin decision and compiled app launch | Printed URLs, ready API; never assume admin bootstrap needed twice |
| API-01 | GET health/ready/auth-me unauthenticated | 200/200/401; no DB secrets or user data in anonymous response |
| UI-01 | Open `/`, `/login`, `/join` in Ubuntu Chrome | Renders, no Next.js red error overlay, navigation works |
| UI-02 | Browse `/cms`, `/campaigns`, `/fleet`, `/delivery`, `/scheduler`, `/playback` | Route and empty/error states display; preview never misrepresented as live MySQL playout |
| UI-03 | Browse `/health`, `/incidents`, `/finance`, `/finance/payouts`, `/communications` | Renders, role/approval or demo disclaimer as appropriate, no auto monetary actions |
| UI-04 | Browse `/member-dashboard`, `/member-onboarding`, `/member-operations`, `/email-verification`, `/phone-verification` | Renders; provider-gated features described honestly; no invented SMS/activation PASS |
| UI-05 | Check width 320, 360/390, 412, 768, 1280; Tab/Shift-Tab/Escape | No overflow or inaccessible sidebar; visible keyboard focus, readable/clear validation |
| AUTH-01 | Signed-out / guest visit to real CMS/Fleet/Campaign panels | Cannot read tenant records; browser-only preview may still render |
| AUTH-02 | Sign in at printed `/login` with the one-time or existing admin | Redirect `/account`, organization identity and `ORGANIZATION_ADMIN`; no hardcoded default password |
| AUTH-03 | Invalid/empty login and refresh | Clear error/validation; no session or secret leaks |
| AUTH-04 | First MFA enrollment and post-login privileged step-up if not already configured | Correct TOTP accepted; old/wrong/replayed rejected; **do not screenshot MFA seed/code** |
| AUTH-05 | Logout; navigate back, refresh `/account`, retry `/auth/me` | Session revoked, login screen/401, no localStorage auth tokens |
| AUTH-06 | Other test user/role/tenant, if already safely provisioned | Permission denied across roles/tenants; BLOCKED if no approved fixtures |
| CMS-01 | Open preview canvas; media and playlist demo tabs | Functional preview with clear non-persistence messaging |
| CMS-02 | Signed-in: `Save current canvas as real DRAFT`, then reload | Tenant MySQL layout persists, DRAFT and no published player configuration |
| CMS-03 | Attempt real playlist creation without a `READY` media asset | UI/save refuses it; nothing unsafely activated |
| CMS-04 | Optional real upload with **configured test-only S3-compatible storage/CORS** | Actual bytes transferred, status PROCESSING until independent verification; BLOCKED without storage |
| CMS-05 | Optional real DRAFT playlist from independently `READY` asset | Tenant-scoped DRAFT persists; BLOCKED without trusted READY asset |
| CAM-01 | Create browser-only campaign demo draft; refresh | Disclaimer says demo; local draft does not persist |
| CAM-02 | Try real campaign DRAFT when no independently READY creative exists | Creation correctly disabled/fail closed |
| CAM-03 | Optional real campaign DRAFT/submit-for-review with approved READY creative | Save remains DRAFT/review, no campaign activation or real compensation; BLOCKED without prerequisites |
| FLEET-01 | Logged in, `/fleet`: register a fake screen, select one of nine TV families | `PENDING_PAIRING` screen recorded in tenant MySQL; TV dropdown labels present |
| FLEET-02 | Inspect one-time pairing code; dismiss and refresh | Code displayed once then hidden; redact in evidence and never paste in chat |
| FLEET-03 | Stop/restart local dev server and reload Fleet/CMS | Existing fake test screen and layout remain in persistent DB |
| DEV-01 | Request registered test screen's `GET /devices/:id/protocol?version=1` **without device secret** | 403 Forbidden, no protocol/tenant data |
| DEV-02 | Legitimately paired isolated test client calls v1, unversioned v1 and unsupported v2 | 200 v1 scoped paths/self-reported flag; 406 unsupported version; Jest covered, manual live client BLOCKED if unpaired |
| DEV-03 | Try wrong/revoked/suspended/retired test device credentials | 403, no grants/media; Jest covers cases, live test requires approved fixtures |
| DEV-04 | Pair native test client; fetch manifest | HTTPS/signed URLs and server-issued grant only for READY/assigned unexpired media; idle with none; BLOCKED without player/media |
| PLAY-01 | Duplicate/expired/replayed/foreign authorization events | No duplicate accepted billable events, fail-closed conditions; MySQL unit/integration evidence, field proof pending |
| PLAY-02 | Real playback on TV; interrupt Wi-Fi/reboot/reconnect | Recover without counterfeit telemetry/offline duplicate; **BLOCKED** until real Android/native player and queue |
| SEC-01 | Unauthorized API and cross-tenant negative tests | 401/403, no secrets or tenant records; refer to Jest/MySQL security evidence |
| FIN-01 | Inspect finance reports with no commercial activation | Reports only; no real payout/commission transfer permitted |
| REC-01 | Refresh/restart only ADFLICK local runtime | Database persists, protected routes still honor session/revocation |
| NATIVE-01 | Android Flutter tests, APK compilation, phone/Android TV remote/media | Requires authorized SDK and hardware; Node CI cannot certify APK — **BLOCKED** until available |
| NATIVE-02 | Remaining TV/desktop/mobile platform packages and device UAT | Requires independently implemented SDK apps/partner access — **BLOCKED** until available |

**Source-specific interpretation:** `scripts/browser-uat.mjs` tests many public/operations routes, widths 320/360/390/412/768/1280, login validation, guest privacy and preview interactions. Its **authenticated admin/MFA automation depends on CI-only injected credentials**; normal operator `npm run local:uat` is **not** a signed-in manual acceptance. The real CMS panel calls MySQL. Actual media transfer requires configured S3-compatible upload plus trusted verification before status READY. The Flutter source's L-band preview has no independently licensed primary TV feed.

## D. Native OS acceptance: never inferred from local browser/Node PASS

| Delivery gate | Target(s) | Current acceptance blocker |
| --- | --- | --- |
| PLAT-01 | Android phone/tablet | APK + real mobile UX/storage/media/offline UAT pending |
| PLAT-02 | Google TV / Android TV | APK + D-pad, codec, overscan, real hardware L-band UAT pending |
| PLAT-03 | iOS/iPadOS | Signed Apple mobile player/device UAT pending |
| PLAT-04 | Samsung Tizen OS | Tizen TV package, remote/decoder hardware UAT pending |
| PLAT-05 | LG webOS | webOS package, model/remote/media hardware UAT pending |
| PLAT-06 | Windows | Signed runtime/installer, real Windows kiosk/media UAT pending |
| PLAT-07 | Linux | Approved distro+architecture, media/kiosk UAT pending |
| PLAT-08 | Roku TV | BrightScript/SceneGraph package, Roku device/certification UAT pending |
| PLAT-09 | Amazon Fire TV OS | Fire OS hardware UAT; distinguish Vega OS by device model |
| PLAT-10 | Titan OS | Partner SDK and real TV approval/UAT pending |
| PLAT-11 | VIZIO SmartCast | VIZIO partner approval, current OS/model device UAT pending |
| PLAT-12 | Xumo TV OS | Entertainment OS vs Scaled stack, partner/hardware UAT pending |
| PLAT-13 | Apple tvOS | Native tvOS signing, Apple TV/Siri Remote UAT pending |

For each eventual device PASS require model/OS version, signed native artifact SHA256, real pairing + revocation, playback surface media rights, decoder, remote/touch, fullscreen/L-band **only inside owned authorized video**, no-creative idle, offline/restart/grant replay, telemetry trust boundary, QA reviewer, rollback/update and separate product sign-off. **Nine TV families; thirteen total delivery groups. No system-wide third-party app/HDMI overlay authorization.**

## E. Defect handling and evidence

**PASS:** exact observed expected behavior with sanitized evidence and SHA. **FAIL:** observed mismatch (capture repro + expected/actual and fix on GitHub, re-run exact-SHA CI and local gate). **BLOCKED:** missing prerequisites/SDK/partner/READY assets/permission; do not forge a PASS. **NOT RUN:** no execution evidence.

Use one session record and case records, stored privately unless sanitized:

```text
ADFLICK LOCAL UAT
Date/time + timezone:
Operator Ubuntu/Chrome version, Node/npm/Docker:
Branch + local SHA:
Backend CI / Frontend CI / Release Evidence run URLs and matching SHA:
Root npm run verify status + log:
Standalone Chrome UAT status + local evidence path:
Local persistent app ready (printed localhost URLs; no tokens):
Test ID:
Expected:
Actual (redacted):
PASS / FAIL / BLOCKED / NOT RUN:
Sanitized screenshot or log path:
Reproduction if FAIL:
Missing prerequisite if BLOCKED:
Reviewer:
Production: NOT AUTHORIZED / NOT DEPLOYED
```

**First manual checkpoint:** complete ENV-01…ENV-03, API-01, AUTH-01…AUTH-05, CMS-02, FLEET-01/02. That is a functional local operator journey, not just a build smoke. Native TV devices and live promotions are later independently approved gates.

Cross-reference `docs/UAT-CHECKLIST.md`, `docs/DEVELOPMENT-DELIVERY-RULES.md`, `docs/CLIENT-PLATFORM-SUPPORT.md` and `docs/PLAYER-PROTOCOL-V1.md`.

## Security regression — guest workspace shell exposed (2026-10-29)

**Source evidence:** user-supplied Ubuntu Chrome Incognito screens at `/account`, `/cms`, `/health` revealed that API auth was correctly returning 401, but the protected operations navigation and CMS browser-only editor were still fully visible without a login. This was **not** acceptable as an admin workspace. The previously documented manual UI-01/UI-02 instructions that tell a *guest* to browse the workspace without sign-in are superseded by these security expectations:

- **Before login:** only `/login` and `/join` return full public pages. All operations/member workspace URLs, including `/`, `/account`, `/cms`, `/fleet`, `/health`, redirect to `/login` **before HTML containing the sidebar/editor is served**.
- **After real login:** `/` dashboard, sidebar, CMS and Fleet can render for authenticated identities. Tenant-sensitive data, actions and member/admin role boundaries remain protected separately by NestJS JWT/MFA/RBAC.
- **After logout / invalid or forged access cookie:** no private page HTML or navigation is rendered and the user is redirected to login. API downtime fails closed rather than allowing a dummy session.
- **Automated:** `npm run local:uat` now creates a disposable test-only organization administrator in its own isolated MySQL to test both guest redirects and a genuinely authenticated browser workflow; no existing developer admin/database is altered. The persistent local operator `local:dev:admin` remains strictly one-time and manual.
- **Security smoke:** compiled web GET `/`, `/cms` and other protected workspace paths without valid cookies must return HTTP **307** with `Location: /login`; invalid fake cookie is also denied. A valid login must receive HTTP 200. Capture only sanitized evidence.

**Manual retest cases added:** `GUEST-01` Incognito root/CMS/Fleet/Health/Account redirect, no shell; `GUEST-02` guest Login/Join 200; `AUTH-07` correct authenticated shell/CMS; `AUTH-08` logout revocation and protected-page redirect. These tests start **NOT RUN** on the new fix SHA until the operator executes them.