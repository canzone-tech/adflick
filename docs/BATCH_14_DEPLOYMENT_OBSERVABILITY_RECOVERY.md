# BATCH 14 — Deployment, Observability & Recovery

## Included

- `apps/api/Dockerfile`: multi-stage API image build, non-root runtime, HTTP liveness health check.
- `apps/web/Dockerfile`: standalone Next.js image build, non-root runtime and HTTP health check.
- `apps/web/next.config.ts`: standalone output for the production container.
- `compose.production.yml`: API/web plus MySQL 8.4, Redis and MinIO; private services have no host-published ports, API/web bind to loopback for a reverse proxy, and health-based dependencies are defined.
- `scripts/backup-mysql.sh`: consistent logical MySQL dump, gzip integrity check and SHA-256 checksum.
- `scripts/restore-mysql.sh`: restore requires explicit `CONFIRM_RESTORE=YES`, validates gzip and checksum when available, and warns that restore is destructive.

## Deployment sequence

1. Prepare `.env.production` using a secret manager or secure deployment process. Never commit it.
2. Ensure `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, and S3 credentials are configured with unique, non-placeholder values.
3. Check the Compose configuration before starting: `docker compose --env-file .env.production -f compose.production.yml config --quiet`.
4. Build: `docker compose --env-file .env.production -f compose.production.yml build`.
5. Apply migrations as a controlled release step using the deployment process; do not run migrations automatically on every API start. Confirm Prisma CLI/schema availability in the chosen migration image before running `npx prisma migrate deploy`.
6. Start services and verify `/api/v1/health`, `/api/v1/ready`, the web root, application login, screen heartbeat, media delivery and incident alert paths.
7. Back up before migration or restore operations. Test restores in a non-production environment on a regular cadence.
8. Put TLS, authentication, rate limits and request-size limits at a managed reverse proxy/load balancer. The Compose port bindings use loopback and are not a replacement for proxy hardening.

## Backup and restore

```bash
scripts/backup-mysql.sh
BACKUP_FILE=./backups/adflick-mysql-YYYYMMDDTHHMMSSZ.sql.gz CONFIRM_RESTORE=YES scripts/restore-mysql.sh
```

The restore command replaces/imports dump contents into the configured database and may overwrite existing tables. Verify the target, test the dump, and obtain approval before use. Store copies off-host and encrypted; keep credentials separate from backups. A checksum detects accidental corruption, not malicious tampering.

## Operational caveats

- The app's scheduler remains in-process. Run exactly one scheduler-enabled API instance until distributed locking/leader election is implemented.
- Redis is currently present in deployment topology, but this batch does not migrate Nest throttling, scheduler locks, sessions, or queues to Redis.
- No Prometheus/OpenTelemetry exporter or centralized log pipeline is claimed by this batch. Use container logs as an interim source and add centralized collection/retention before production scale.
- The API image currently carries builder `node_modules` to preserve generated Prisma/runtime compatibility; optimize dependencies and scan/sign images before public release.
- Compose does not terminate TLS. Keep published ports restricted, use a reverse proxy and firewall, and configure HTTPS origins.
- Production environment interpolation for secrets must be tested carefully; passwords containing URL-reserved characters require percent-encoding in `DATABASE_URL`. Prefer a prebuilt, secret-managed `DATABASE_URL` in production rather than relying on naive string concatenation.
- Backup automation, retention, encryption/key management, restore drills, image signing, deployment approvals, blue/green rollback and distributed scheduler locking remain follow-up work.

## Acceptance checklist

- [ ] Compose config parses with a real `.env.production`.
- [ ] API and web Docker images build successfully.
- [ ] API liveness remains healthy during a database outage; readiness returns 503.
- [ ] MySQL and Redis are not exposed on host ports in the production Compose file.
- [ ] Backup gzip and checksum verification succeeds.
- [ ] Restore drill passes against a disposable database and critical data checks pass.
- [ ] TLS proxy, access logs, log retention, alerts and rollback are verified.
- [ ] Scheduler remains single-instance; playback proof-of-play is not treated as sole evidence for billing/payout.
