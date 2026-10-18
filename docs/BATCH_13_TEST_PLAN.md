# BATCH 13 Test Plan

## Automated gates

1. `npm run check:source` — verifies MySQL-only datasource policy and source layout.
2. `npm run validate:env` — verifies environment requirements; test production mode with missing and placeholder secrets and confirm non-zero exit.
3. `npx prisma validate` and `npx prisma generate` — verify schema and client generation.
4. `npm run typecheck:api` and `npm run typecheck:web` — detect TypeScript regressions.
5. `npm run lint` — lint API and web workspaces.
6. `npm run test:api` — runs API unit tests, including health readiness success/failure and webhook behavior.
7. `npm run build:api` and `npm run build:web` — compile production outputs.

## Health endpoint checks

- `GET /api/v1/health` returns HTTP 200 and `api: ok` even if the database is unavailable.
- `GET /api/v1/ready` returns HTTP 200 when `SELECT 1` succeeds.
- `GET /api/v1/ready` returns HTTP 503 when the database query fails.
- Readiness failure responses must not include exception messages, connection strings, hostnames, usernames, or passwords.

## Database and release checks

- Confirm Prisma datasource provider is `mysql` and CI database image is `mysql:8.4`.
- Run migrations against a disposable MySQL 8.4 database before any production rollout.
- Validate production env checks with intentionally missing, placeholder, and duplicate JWT secrets.
- Confirm no `.env` or secret-bearing artifact is committed.

## Status recording

Do not mark a command as passed unless its exit code was observed. Static checks do not replace builds, database migration tests, end-to-end tests, security review, or restore drills.
