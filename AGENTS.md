# ADFLICK engineering agents
Project isolation: ADFLICK only. Work on `dev/local-foundation`; do not edit `main`, `development`, other repos, production systems, or shared resources without specific authorization.

Source of truth: the GitHub repository, current source code, and authoritative MySQL 8.4/Prisma migrations. Batch archives are **candidates** only, not evidence of accepted features. Do not blindly merge later ZIP snapshots.

All functionality requires explicit acceptance criteria, secure tenant/RBAC checks, deterministic idempotency for critical flows, and tests. Approved production rules must be versioned and auditable. No live money movement is authorized.

Run `npm run verify` against a **disposable local** MySQL instance. Backend CI, Frontend CI, and Release Evidence must all PASS on the same SHA before claiming CI accepted; local verify needs separate user confirmation. The release artifact cannot authorize production.

Historical schema migrations are immutable if applied in any authoritative environment. Block and escalate migration-repair decisions if application history is unknown; do not bypass a failing migration.

Use normal fast-forward Git updates with expected-HEAD checks; preserve unrelated work. Document every technical gate result as PASS, FAIL, or BLOCKED. Never claim a test ran without logs.

Consolidated batch documentation now lives in `docs/BATCH-HISTORY.md`; do not recreate one Markdown/text/CSV file per historical batch. Preserve source scans, executable test cases, Prisma migrations and Git recoverability. SRS v1.0 functional scope approved 2026-10-27; all compensation/legal/payment policies require separate authorization.

## Cross-chat continuity and player OS scope (2026-10-29)

Before resuming after a long conversation, read `docs/NEXT-CHAT-HANDOFF.md` and `docs/CLIENT-PLATFORM-SUPPORT.md`. The owner first confirmed seven advertising-device targets, then supplied **nine mandatory TV platform families**: Google TV/Android TV, Tizen OS, webOS, Roku TV, Fire TV OS, Titan OS, VIZIO SmartCast, Xumo TV OS and Apple tvOS. Three overlap, so track **PLAT-01…PLAT-13** while preserving all old Android/iOS mobile, Windows and Linux requirements. Native player/device UAT and OEM rights are not approved by a platform name. Current Android Flutter source does not establish cross-platform native binaries or platform UAT. Keep the shared delivery API contract and record separately what is required, implemented, compiled, device-tested and approved. The original client SRS DOCX has not been independently available for a verbatim OS clause; do not invent quotations.
