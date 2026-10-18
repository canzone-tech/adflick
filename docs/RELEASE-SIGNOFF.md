# Release sign-off — PENDING

| Gate | State | Evidence |
| --- | --- | --- |
| Source baseline imported | PRESENT, NOT ACCEPTED | `development` commit `799d689`; batch register |
| Lockfile/clean dependency install | PASS on working branch | Node 24 + lockfile v3, deterministic npm ci; backend/frontend CI logs |
| MySQL migration clean deploy | FAIL — original migration 010 collation mismatch, issue #5 | [Latest original baseline CI](https://github.com/canzone-tech/adflick/actions/runs/39125218542) |
| Backend CI | FAIL — clean MySQL migration; 29/29 unit suites and 92/92 tests PASS; compiled backend build PASS | [Backend CI](https://github.com/canzone-tech/adflick/actions/runs/39125218542), commit `7180e5ac` |
| Frontend CI | PASS — lint/types, production build, compiled route smoke | [Frontend CI](https://github.com/canzone-tech/adflick/actions/runs/39125218523), commit `7180e5ac` |
| Exact-SHA Release Evidence | FAIL — Backend gate incomplete | [Release Evidence](https://github.com/canzone-tech/adflick/actions/runs/39125218516), commit `7180e5ac` |
| Local `npm run verify` | NOT CONFIRMED by operator | Pending |
| Flutter Smart TV platform UAT | BLOCKED — source missing | Issue #3 |
| Business/provider approval | PENDING | Product owner required |
| Backup/restore and rollback | PENDING | Production operator required |
| Production deployment | NOT AUTHORIZED | No production action taken |

Only move an item to PASS with exact SHA, run URL/report and reviewer. Sign-off of release and migration policy requires explicit product owner approval.
