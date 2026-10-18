# ADFLICK engineering agents
Project isolation: ADFLICK only. Work on `dev/local-foundation`; do not edit `main`, `development`, other repos, production systems, or shared resources without specific authorization.

Source of truth: the GitHub repository, current source code, and authoritative MySQL 8.4/Prisma migrations. Batch archives are **candidates** only, not evidence of accepted features. Do not blindly merge later ZIP snapshots.

All functionality requires explicit acceptance criteria, secure tenant/RBAC checks, deterministic idempotency for critical flows, and tests. Approved production rules must be versioned and auditable. No live money movement is authorized.

Run `npm run verify` against a **disposable local** MySQL instance. Backend CI, Frontend CI, and Release Evidence must all PASS on the same SHA before claiming CI accepted; local verify needs separate user confirmation. The release artifact cannot authorize production.

Historical schema migrations are immutable if applied in any authoritative environment. Block and escalate migration-repair decisions if application history is unknown; do not bypass a failing migration.

Use normal fast-forward Git updates with expected-HEAD checks; preserve unrelated work. Document every technical gate result as PASS, FAIL, or BLOCKED. Never claim a test ran without logs.
