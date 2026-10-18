# Delivery and verification rules

- Approved branch: `dev/local-foundation`. Source recovery baseline: `development` at `799d689`. Default `main` is not the working branch.
- Import batches only after isolate, SHA-256 inventory, code review, dependency/migration diff, and regression coverage.
- Development gates: `npm run verify` (clean install, source checks, environment, Prisma, migrations to disposable local MySQL, lint/typecheck, unit, integration, production builds, compiled startup, HTTP smoke).
- CI: separate Backend CI, Frontend CI, exact-SHA Release Evidence. Keep CI/local parity. CI failures are blockers, not passed exceptions.
- Never replay or edit an applied migration; confirm external usage before resolving historical checksum conflicts.
- Finance: MySQL authoritative, approved versioned policy only, maker-checker, ledger + reconciliation, no live payouts without explicit independent approval.
- Production: separate approval of exact immutable source-free release artifact, off-host encrypted backup and isolated restore, rollback, smoke and operator sign-off.
- Handoff after three exact-SHA green CI checks: `git pull` then `npm run verify`; user confirms local result.

## Single-command local verification

When the exact-SHA CI gates are accepted, `npm run verify` runs on Node.js 24 with Docker Engine/Desktop installed. The local command automatically starts a fresh `mysql:8.4` container with randomized credentials, no persistent volume, and a random **127.0.0.1-only** published port. It overrides any developer `DATABASE_URL` **for the verification process only**, and removes only its own container after the gate (including on SIGINT/SIGTERM). It never runs against shared databases or Docker Compose volumes. The command validates dependencies, Prisma, lint/typechecks, unit, MySQL integration, compiled API readiness/401, frontend build and route smoke.

CI uses its own GitHub Actions disposable MySQL service and never starts this local container. Production execution and production DB migrations are forbidden. If Docker is missing, verification fails with an actionable error; manual source patches or database resets are never a substitute.
