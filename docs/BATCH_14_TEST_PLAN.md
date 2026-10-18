# BATCH 14 Test Plan

## Static checks
- Parse all JSON manifests.
- Validate shell syntax with `bash -n scripts/backup-mysql.sh scripts/restore-mysql.sh`.
- Confirm the Prisma datasource remains MySQL.
- Confirm production Compose publishes no MySQL, Redis or MinIO host ports.
- Confirm production Compose API/web ports bind to `127.0.0.1` only.
- Confirm backup restore requires `CONFIRM_RESTORE=YES`.

## Environment-dependent tests (not implied by static checks)
- `docker compose --env-file .env.production -f compose.production.yml config --quiet`
- Build both images from a clean environment.
- Verify liveness/readiness and web health in a running stack.
- Run backup, verify gzip/hash, restore into disposable MySQL 8.4, then validate representative data and relations.
- Test failure scenarios: DB unavailable, storage unavailable, stale screen, API container restart, disk pressure and invalid JWT secrets.

## Release blocking issues
Do not release if image builds fail, readiness never becomes healthy, backups cannot be restored, secrets are placeholders, public database/storage ports are exposed, or production scheduler concurrency is not constrained.
