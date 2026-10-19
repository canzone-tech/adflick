# Release sign-off — PENDING

| Gate | State | Evidence |
| --- | --- | --- |
| Source baseline imported | PRESENT, NOT ACCEPTED | `development` commit `799d689`; batch register |
| Lockfile/clean dependency install | PASS on working branch | Node 24 + lockfile v3, deterministic npm ci; backend/frontend CI logs |
| MySQL migration clean deploy | PASS on clean disposable MySQL 8.4 — 18/18 migrations; FK audit 0 findings | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39207015989), commit `42260ea0` |
| Backend CI | PASS — 92 unit, 6 security HTTP E2E, 13 finance HTTP E2E, MySQL 8.4, compiled runtime smoke | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39206623192), commit `42260ea0` |
| Frontend CI | PASS — lint/types, production build, compiled route smoke | [Frontend CI](https://github.com/canzone-tech/adflick/actions/runs/39207015994), commit `42260ea0` |
| Exact-SHA Release Evidence | PASS — Backend CI and Frontend CI on same commit; production approval PENDING | [Release Evidence](https://github.com/canzone-tech/adflick/actions/runs/39207015995), commit `42260ea0` |
| Local `npm run verify` | **PASS reported in user-provided Ubuntu terminal log** on `42260ea0`; not independently executed by assistant | Node 24.19.0; npm 11.17.0; MySQL 8.4 (18 migrations), 92 unit, 6 security E2E, 13 finance E2E, backend/frontend builds and compiled runtime smoke PASS |
| Flutter Smart TV platform UAT | BLOCKED — source missing | Issue #3 |
| Business/provider approval | PENDING | Product owner required |
| Backup/restore and rollback | PENDING | Production operator required |
| Production deployment | NOT AUTHORIZED | No production action taken |

Only move an item to PASS with exact SHA, run URL/report and reviewer. Sign-off of release and migration policy requires explicit product owner approval.

## Controlled CI diagnostic (non-authoritative)

On commit `3de4ee13`, [Migration Compatibility Diagnostics](https://github.com/canzone-tech/adflick/actions/runs/39126886352) PASS with copies of seven later migration SQL files normalized in a temporary directory and an isolated disposable MySQL 8.4 schema. **All 17 migrations applied**, MySQL-backed security HTTP tests **6/6 PASS**, finance HTTP/transaction tests **13/13 PASS**, compiled API startup/readiness/401 smoke PASS. This only narrows the incompatibility to the original migration-history collation mismatch; it is **not** approval to alter applied migration checksums or an accepted Backend CI replacement.

The approved local gate now uses the same original historical source migrations plus an additional append-only pre-010 ID/FK bridge. CI passed on a fresh test schema. Live/staging migration history adoption remains an independent production approval question, not a reason to skip or rewrite a migration. See `docs/MIGRATION-FK-COLLATION-BRIDGE.md`.

## Local developer acceptance — evidence received 19 October 2026

**Source revision:** `42260ea0a471d5063b50d0bece74b71ad01fc233` on `dev/local-foundation`. User shared the Ubuntu terminal output for `npm run verify` from the first-time Git clone. **The assistant did not independently operate the user's workstation**; the complete pasted terminal log ends in `Verification PASS: --all. This does not authorize production deployment.`

- Node.js **24.19.0**, npm **11.17.0**; locked `npm ci` installed 912 packages.
- Dependency/runtime, clean release preflight, all Batch static source checks, environment validation, Prisma schema/client, backend typecheck/lint and production NestJS build **PASS**.
- Backend Jest **29/29 test suites, 92/92 tests PASS**, with statement coverage **30.31%**. No blanket coverage threshold is demonstrated by this log.
- Compiled API startup, liveness/readiness and unauthenticated 401 smoke **PASS**.
- Disposable loopback-hosted MySQL 8.4: FK audit **0 findings**, all **18/18** Prisma migrations applied; MySQL-backed security **6/6** and finance/reconciliation HTTP/transaction **13/13** tests **PASS**.
- Frontend TypeScript/lint, Next.js 15.5.28 production build and compiled route smoke **PASS**.
- **Nonblocking technical debt:** 72 backend ESLint `no-explicit-any` warnings, two CSS autoprefixer `end` compatibility warnings, npm `allow-scripts` advisories on 8 packages, and relatively low overall Jest statement coverage. These are not test failures, nor evidence of production acceptance.
- **Not established:** real browser visual/device UAT, physical Smart TV player, provider payout certification, production database upgrade compatibility, off-host encrypted backup/isolated restore, deployment, and unrelated local project runtime isolation beyond the disposable database design.

**Release decision:** Local development technical verification is **PASS based on user evidence**; production business/operator approval remains **PENDING**. All further changes require their own exact-SHA CI gate and local verification when warranted.

## Phase 1 functional development acceptance — 19 October 2026

Owner explicitly approved the **local-development-only** scope; production and Phase 2 remain separate.
Implementation verified on commit `f157286f691b6b14aeec3b14d76a627a4a0b9405`:

- [Backend CI 39239629953](https://github.com/canzone-tech/adflick/actions/runs/39239629953) **SUCCESS:** root backend validation, clean MySQL 8.4/18 migrations, 92/92 unit, 6/6 security, 13/13 finance; **additional persistent-dev integration** created the first organization admin with Argon2, rejected repeat bootstrap and invalid login, tested real access/refresh/logout tokens, unauthorized 401, SCREEN_OWNER finance role 403, restarted the owned MySQL container and confirmed the account/role can authenticate again.
- [Frontend CI 39239629962](https://github.com/canzone-tech/adflick/actions/runs/39239629962) **SUCCESS:** original compiled 12-route Chrome UAT plus a separate ADFLICK-owned persistent-development Chrome test using a generated, non-committed account: real sign-in to `/account`, organization role displayed, browser route refresh, sign-out and server-side 401 revocation. Screenshot artifact available on the run.
- [Release Evidence 39239629943](https://github.com/canzone-tech/adflick/actions/runs/39239629943) **SUCCESS:** same exact SHA backend and frontend gates; **production approval PENDING**.
- `npm run local:dev:admin` (operator-only no-echo first-admin CLI) and `npm run local:dev:up` (owned persistent Docker volume) introduced; `npm run verify` remains disposable and unaffected. No production config changes, no real payments, no unrelated container actions.

**Not yet confirmed by user on this new SHA:** full Ubuntu root `npm run verify`, interactive first-admin CLI, physically observed signed-in page, restart of user's persisted local database, visual operator approval. Do not confuse GitHub CI test environment with actual Ubuntu local result.
