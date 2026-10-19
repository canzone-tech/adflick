# Release sign-off — PENDING

| Gate | State | Evidence |
| --- | --- | --- |
| Source baseline imported | PRESENT, NOT ACCEPTED | `development` commit `799d689`; batch register |
| Lockfile/clean dependency install | PASS on working branch | Node 24 + lockfile v3, deterministic npm ci; backend/frontend CI logs |
| MySQL migration clean deploy | PASS on clean disposable MySQL 8.4 — 18/18 migrations; FK audit 0 findings | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39206623192), commit `6116e1c8` |
| Backend CI | PASS — 92 unit, 6 security HTTP E2E, 13 finance HTTP E2E, MySQL 8.4, compiled runtime smoke | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39206623192), commit `6116e1c8` |
| Frontend CI | PASS — lint/types, production build, compiled route smoke | [Frontend CI](https://github.com/canzone-tech/adflick/actions/runs/39206623169), commit `6116e1c8` |
| Exact-SHA Release Evidence | PASS — Backend CI and Frontend CI on same commit; production approval PENDING | [Release Evidence](https://github.com/canzone-tech/adflick/actions/runs/39206623179), commit `6116e1c8` |
| Local `npm run verify` | PENDING user-run verification; repo script provisions disposable localhost MySQL Docker | Request after exact-SHA 3x CI PASS on final commit |
| Flutter Smart TV platform UAT | BLOCKED — source missing | Issue #3 |
| Business/provider approval | PENDING | Product owner required |
| Backup/restore and rollback | PENDING | Production operator required |
| Production deployment | NOT AUTHORIZED | No production action taken |

Only move an item to PASS with exact SHA, run URL/report and reviewer. Sign-off of release and migration policy requires explicit product owner approval.

## Controlled CI diagnostic (non-authoritative)

On commit `3de4ee13`, [Migration Compatibility Diagnostics](https://github.com/canzone-tech/adflick/actions/runs/39126886352) PASS with copies of seven later migration SQL files normalized in a temporary directory and an isolated disposable MySQL 8.4 schema. **All 17 migrations applied**, MySQL-backed security HTTP tests **6/6 PASS**, finance HTTP/transaction tests **13/13 PASS**, compiled API startup/readiness/401 smoke PASS. This only narrows the incompatibility to the original migration-history collation mismatch; it is **not** approval to alter applied migration checksums or an accepted Backend CI replacement.

The approved local gate now uses the same original historical source migrations plus an additional append-only pre-010 ID/FK bridge. CI passed on a fresh test schema. Live/staging migration history adoption remains an independent production approval question, not a reason to skip or rewrite a migration. See `docs/MIGRATION-FK-COLLATION-BRIDGE.md`.
