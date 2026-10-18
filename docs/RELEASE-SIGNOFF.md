# Release sign-off — PENDING

| Gate | State | Evidence |
| --- | --- | --- |
| Source baseline imported | PRESENT, NOT ACCEPTED | `development` commit `799d689`; batch register |
| Lockfile/clean dependency install | PASS on working branch | Node 24 + lockfile v3, deterministic npm ci; backend/frontend CI logs |
| MySQL migration clean deploy | FAIL — original migration 010 collation mismatch, issue #5 | [Latest original baseline CI](https://github.com/canzone-tech/adflick/actions/runs/39125218542) |
| Backend CI | FAIL — clean MySQL migration; 29/29 unit suites and 92/92 tests PASS; compiled backend build PASS | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39125218542), commit `7180e5ac` |
| Frontend CI | PASS — lint/types, production build, compiled route smoke | [Frontend CI](https://github.com/canzone-tech/adflick/actions/runs/39125218523), commit `7180e5ac` |
| Exact-SHA Release Evidence | FAIL — Backend gate incomplete | [Release Evidence](https://github.com/canzone-tech/adflick/actions/runs/39125218516), commit `7180e5ac` |
| Local `npm run verify` | NOT CONFIRMED by operator; disposable Docker helper added, local gate still blocked by historic migration FK | CI smoke pending, operator run only after all 3 CI gates green |
| Flutter Smart TV platform UAT | BLOCKED — source missing | Issue #3 |
| Business/provider approval | PENDING | Product owner required |
| Backup/restore and rollback | PENDING | Production operator required |
| Production deployment | NOT AUTHORIZED | No production action taken |

Only move an item to PASS with exact SHA, run URL/report and reviewer. Sign-off of release and migration policy requires explicit product owner approval.

## Controlled CI diagnostic (non-authoritative)

On commit `3de4ee13`, [Migration Compatibility Diagnostics](https://github.com/canzone-tech/adflick/actions/runs/39126886352) PASS with copies of seven later migration SQL files normalized in a temporary directory and an isolated disposable MySQL 8.4 schema. **All 17 migrations applied**, MySQL-backed security HTTP tests **6/6 PASS**, finance HTTP/transaction tests **13/13 PASS**, compiled API startup/readiness/401 smoke PASS. This only narrows the incompatibility to the original migration-history collation mismatch; it is **not** approval to alter applied migration checksums or an accepted Backend CI replacement.

The approved local gate must use unmodified historical source migrations and remains blocked. A separately reviewed migration adoption/compatibility decision is required before local testing handoff.
