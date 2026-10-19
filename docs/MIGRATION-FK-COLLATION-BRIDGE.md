# ADFLICK MySQL ID/FK collation bridge — source recovery decision (19 Oct 2026)

## Why this exists
The original Batch 50 MySQL 8.4 migration history mixed `utf8mb4_0900_ai_ci` on identifiers created in migrations 001–008 and `utf8mb4_unicode_ci` on ID/FK columns in migration 010 and later. An isolated clean replay failed at `Incident_organizationId_fkey` with Prisma P3018 / MySQL error 3780. Static audit identified **17 incompatible FK relationships**.

## Fix reviewed in GitHub
One **append-only ordered migration**, `prisma/migrations/202610140009z_identifier_fk_collation_bridge/migration.sql`, runs after 009 and before 010 on a **fresh** database. It:
1. Drops 35 existing foreign-key constraints created by migrations 001–008 without turning foreign-key checks off.
2. Alters only 53 opaque ID and ID-reference VARCHAR(30) columns across 18 early tables to `utf8mb4_unicode_ci`; all other columns (email, slug, display name, budgets, reward/finance policy values) are left unchanged.
3. Restores all 35 constraints by exact name, with original `ON DELETE` and `ON UPDATE` actions.

**All original 17 migration files and checksums remain unmodified.** This adds an 18th migration. Changing identifier collation can affect string equality and indexes; the reviewed scope is identifiers only, but a non-empty database requires its own collision and semantics review. MySQL DDL is not transactionally rolled back; partial errors can leave intermediate state.

## Verified non-production evidence
- [Backend CI 39206623192](https://github.com/canzone-tech/adflick/actions/runs/39206623192): **18/18 migrations applied** to an empty disposable MySQL 8.4 service; static FK audit **0 findings**; 92/92 unit tests, security 6/6, finance 13/13, compiled API health/readiness/401 smoke PASS.
- [Frontend CI 39206623169](https://github.com/canzone-tech/adflick/actions/runs/39206623169): lint/typecheck, production build and route smoke PASS.
- [Exact-SHA Release Evidence 39206623179](https://github.com/canzone-tech/adflick/actions/runs/39206623179): PASS on SHA `6116e1c8610aa0f822dcd90d74624bb687a3fb4b`. Production approval separately PENDING.
- [Independent diagnostics 39206623182](https://github.com/canzone-tech/adflick/actions/runs/39206623182): copied **unaltered** SQL and applied to another isolated diagnostic MySQL; E2E and temporary Docker lifecycle checks PASS.

## Strict adoption boundary
The state of any existing development/staging/production `_prisma_migrations` ledger is **unknown**. Do not assume that an already-applied schema needs this bridge, nor apply it retroactively to a database where later migrations have already run. Never reset, `migrate resolve`, edit historical checksums or disable FK checks to get green.

Before proposing **any** non-empty database migration: obtain operator inventory of existing Prisma migration names/checksums and schema metadata, check constraint names/character collations and unique indexes against data, confirm maintenance window and write quiescence, capture real encrypted off-host backup plus isolated restore proof, and get explicit database/operator sign-off. Database migration uses a separately authorized process, never the application VPS. No automatic schema rollback.

## Local developer gate
When exact-SHA Backend CI, Frontend CI and Release Evidence have all PASSED on the **final** SHA, the user may run from repo root `git pull` then `npm run verify` under Node.js 24 with Docker Engine/Desktop running. The local verifier creates its own disposable MySQL 8.4 with a unique container ID, random credentials, ephemeral loopback port and **no persistent volume**; then executes the full unchanged migrations and suites, and cleans only its own container. It never touches existing MySQL databases or Docker Compose volumes. Local PASS requires user evidence and confirmation.
