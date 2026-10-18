# ADFLICK — Source Recovery / Milestone Status (18 Oct 2026)

**Status: candidate source import; not a production release.** This branch holds the verified cumulative **Batch 50** snapshot, not a merged Batch 001–150 system. Root source archive SHA-256: `9218928155bee854a16479a01feb71308177c85941189a9a02a7774929165783`.

## Evidence-backed classification

| Batch range | Count | Classification | Acceptance |
|---|---:|---|---|
| 001–050 | 50 | Cumulative source present in Batch 50 snapshot; isolated archive inventory and static source scripts | **Not accepted:** clean install, builds, live MySQL tests, runtime and CI not verified |
| 051–100 | 50 | Recovery specifications/register only, original implementation code missing | **Blocked:** need source archives/history |
| 101 | 1 | Missing archive | **Blocked:** need source archive |
| 102–150 | 49 | Separate additive source starters with README/test/schema fragments | **Not integrated:** do not overlay files or replay Prisma fragments |

Accepted/completed release batches: **0 evidence-backed**. This does not mean all code is unfinished: implementation artifacts exist, but acceptance gates have not passed.

## Observed checks

- `npm run check:source` in isolated Batch 50 snapshot: **PASS** (static only).
- `npm run verify:clean-release`: **FAIL**, root `package-lock.json` absent.
- `CI=true npm run verify:dependencies`: **FAIL**, required lockfile absent.
- `npm ci`, Prisma/MySQL migrations, lint/typecheck, API/Web builds, E2E security/finance, compiled API/web runtime smoke, device testing and GitHub CI: **not verified**.
- Current environment cannot reach npm registry (DNS EAI_AGAIN). Do not fabricate or bypass lockfile.
- No Flutter/Dart Smart TV application source present. The supplied L-Shape HTML is a reference demo only.
- Critical business boundary: do not enable real transfers or count unverified playback towards payments.

## Milestone gates

1. **M0 Repository recovery and provenance:** cumulative snapshot inventoried, development branch staged; acceptance pending until reviewed Git diff and test evidence.
2. **M1 Reproducible dependencies/build:** BLOCKED, generate and review npm lockfile with registry access; maintain `npm ci` in CI and Docker.
3. **M2 Database/API/Web/security:** CODE PRESENT, acceptance pending MySQL 8.4 migration, tests, production build, compiled startup, HTTP/route smoke and RBAC/tenant tests.
4. **M3 Player and device E2E:** BLOCKED, Flutter player implementation and physical/supported device matrix missing.
5. **M4 Batch 051–101 recovery:** BLOCKED, missing original implementations; do not mark docs as source.
6. **M5 Batch 102–150 integration:** NOT STARTED. Review each starter against current services/schema and integrate dependency by dependency, with append-only migrations and regression tests.
7. **M6 Production release:** NO-GO until all gates are green and sign-offs captured.

Source archives are preserved outside repository; do not commit ZIPs, real secrets, .env files, generated files or DB backups.

See `docs/BATCH_50_CLEAN_RELEASE_PREFLIGHT.md`, `docs/ARCHITECTURE.md`, engineering handover guide and `docs/MILESTONE_REGISTER_001_150.csv`.
