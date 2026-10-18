# BATCH 13 — Automated QA, CI/CD & Production Readiness

## Scope

Batch 13 adds repeatable repository checks, a GitHub Actions verification workflow, a dependency-review workflow, environment validation, and separate API liveness/readiness endpoints. The Prisma datasource remains **MySQL** and CI uses **MySQL 8.4**.

## New behavior

- `GET /api/v1/health` is a liveness endpoint. It does not query dependencies, so a database outage does not cause a healthy process to be restarted unnecessarily.
- `GET /api/v1/ready` executes `SELECT 1`. It returns HTTP 200 with `status: ready` when the database is reachable, or HTTP 503 with a sanitized `status: not_ready` response otherwise.
- `npm run check:source` verifies the Prisma provider is MySQL, the database URL is environment-based, package manifests parse, and migration folders have SQL files.
- `npm run validate:env` validates the database protocol and required secrets. Production mode rejects placeholder secrets, matching access/refresh secrets, and localhost web origins.
- `npm run verify:release` is the local release-gate sequence. It is intentionally strict: any failed command blocks the sequence.
- `.github/workflows/ci.yml` installs dependencies and runs source checks, env validation, Prisma validation/generation, TypeScript checks, lint, API tests and production builds against MySQL 8.4.
- `.github/workflows/dependency-review.yml` checks pull-request dependency changes for high-severity advisories.

## Commands

```bash
npm install
npm run check:source
npm run validate:env
npx prisma validate
npx prisma generate
npm run typecheck:api
npm run typecheck:web
npm run lint
npm run test:api
npm run build:api
npm run build:web
```

For a production-like environment, set `NODE_ENV=production` and provide real secrets through the deployment secret manager. Do not commit `.env` files or use the CI credentials outside CI.

## Release checklist

- [ ] CI workflow is green on the exact commit intended for release.
- [ ] Review migration SQL; take a database backup before production migration.
- [ ] Run `npx prisma migrate deploy` from a controlled release job, not on every application startup.
- [ ] Verify `/api/v1/health` and `/api/v1/ready` from the deployment network.
- [ ] Confirm `WEB_ORIGIN`, `DATABASE_URL`, JWT secrets, storage configuration and webhook allowlist are environment-specific.
- [ ] Confirm scheduler is enabled on only one API replica until distributed leader locking is implemented.
- [ ] Verify backup restoration, alert delivery, rollback and incident escalation procedures.
- [ ] Do not use playback-event records alone as the basis for advertiser billing or owner payouts; server-side playback authorization, anti-replay controls, anomaly review and finance approval remain required.

## Important limitations

- GitHub Actions is configured but cannot be considered passed until it runs in the repository's CI environment.
- The local environment may not have dependencies installed; run all listed commands before release.
- This is not a complete deployment pipeline: production image publishing, signing, deployment approvals, secret management, database backup automation, distributed scheduler locking, and durable notification outbox/retry handling remain future work.
- The dependency-review workflow depends on GitHub's dependency graph/review support being enabled for the repository.
