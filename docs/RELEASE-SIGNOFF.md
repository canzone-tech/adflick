# Release sign-off — PENDING

| Gate | State | Evidence |
| --- | --- | --- |
| Source baseline imported | PRESENT, NOT ACCEPTED | `development` commit `799d689`; batch register |
| Lockfile/clean dependency install | Lockfile generated, CI still being audited | Approved working branch CI |
| MySQL migration clean deploy | FAIL — historical collation mismatch, issue #5 | [CI failing run](https://github.com/canzone-tech/adflick/actions/runs/39122787402) |
| Backend CI | NOT GREEN | GitHub Actions |
| Frontend CI | NOT GREEN | GitHub Actions |
| Exact-SHA Release Evidence | NOT GREEN | GitHub Actions |
| Local `npm run verify` | NOT CONFIRMED by operator | Pending |
| Flutter Smart TV platform UAT | BLOCKED — source missing | Issue #3 |
| Business/provider approval | PENDING | Product owner required |
| Backup/restore and rollback | PENDING | Production operator required |
| Production deployment | NOT AUTHORIZED | No production action taken |

Only move an item to PASS with exact SHA, run URL/report and reviewer. Sign-off of release and migration policy requires explicit product owner approval.
