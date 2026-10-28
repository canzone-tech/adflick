# Delivery and verification rules

- Approved branch: `dev/local-foundation`. Source recovery baseline: `development` at `799d689`. Default `main` is not the working branch.
- Import batches only after isolate, SHA-256 inventory, code review, dependency/migration diff, and regression coverage.
- Source verification: `npm run check:source` runs schema/manifest checks, domain-named regression contracts and the shared UI shell; any missing or failing contract blocks verification. Historical recovery batch IDs remain audit metadata, not delivery units. Do not confuse static source checks with executed unit/MySQL tests.
- Development gates: `npm run verify` (clean install, source checks, environment, Prisma, migrations to disposable local MySQL, lint/typecheck, unit, integration, production builds, compiled startup, HTTP smoke).
- CI: separate Backend CI, Frontend CI, exact-SHA Release Evidence. Keep CI/local parity. CI failures are blockers, not passed exceptions.
- Never replay or edit an applied migration; confirm external usage before resolving historical checksum conflicts.
- Finance: MySQL authoritative, approved versioned policy only, maker-checker, ledger + reconciliation, no live payouts without explicit independent approval.
- Production: separate approval of exact immutable source-free release artifact, off-host encrypted backup and isolated restore, rollback, smoke and operator sign-off.
- Handoff after three exact-SHA green CI checks: `git pull` then `npm run verify`; user confirms local result.

## Single-command local verification

When the exact-SHA CI gates are accepted, `npm run verify` runs on Node.js 24 with Docker Engine/Desktop installed. The local command automatically starts a fresh `mysql:8.4` container with randomized credentials, no persistent volume, and a random **127.0.0.1-only** published port. It overrides any developer `DATABASE_URL` **for the verification process only**, and removes only its own container after the gate (including on SIGINT/SIGTERM). It never runs against shared databases or Docker Compose volumes. The command validates dependencies, Prisma, lint/typechecks, unit, MySQL integration, compiled API readiness/401, frontend build and route smoke.

CI uses its own GitHub Actions disposable MySQL service and never starts this local container. Production execution and production DB migrations are forbidden. If Docker is missing, verification fails with an actionable error; manual source patches or database resets are never a substitute.

## Legacy migration compatibility bridge

Use the ordered new migration `202610140009z_identifier_fk_collation_bridge` on **fresh disposable** CI/local databases as part of normal Prisma migrate deploy. Existing migration SQL remains untouched. This bridge modifies opaque ID/FK collations, temporarily drops/restores 35 foreign keys with original actions and is nontransactional MySQL DDL. Never auto-run on production or any existing authoritative database with unknown history. For staging/production, explicitly inspect `_prisma_migrations`, table/column collations and actual data, approve maintenance and migration backup/restore separately; see `docs/MIGRATION-FK-COLLATION-BRIDGE.md`.

## Approved persistent development data boundary

The new `local:dev:*` workflows are limited to ADFLICK-only localhost MySQL 8.4 Docker resources with validated ownership labels and an owned volume; operator approval granted for local development only. Never use `docker compose down -v`, `docker volume prune`, or destructive resets. Local state/credentials are ignored by Git; don't paste them to chat. Development org bootstrap grants only `ORGANIZATION_ADMIN`, not `SUPER_ADMIN`, and fails closed if any existing accounts/organizations exist. The demo data seeder is not auto-run. `local:dev:up` is **not** root local acceptance; continue to use `npm run verify` and exact-SHA three-CI green before handoff.
