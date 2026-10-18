# ADFLICK production runbook — NOT AUTHORIZED

Preconditions: exact SHA green Backend CI + Frontend CI + Release Evidence; confirmed local `npm run verify`; source-free compiled release artifact with outer/inner checksum and embedded SHA; independent product and operator sign-off. **No deployment is authorized by this file.**

Before touching servers: verify current healthy app runtime, approved host and independent non-root PM2_HOME, approved ports/vhosts, production secrets, MySQL schema migration compatibility and backups. Require *actual encrypted off-host backup and isolated restore proof*, retention, checksum verification, available previous release and tested rollback.

Use reviewed manual deployment plan for the approved immutable build artifact. Never checkout source, execute `npm install` or source migrations on the application VPS. A database migration, if needed, is a separate explicitly authorized change. Restrict changes to ADFLICK service/users/volumes/vhost and never touch unrelated projects.

After switch: compare embedded/runtime/deployment SHA, verify scoped PM2 process, localhost readiness, HTTPS/TLS, admin/public routes, API 401 unauthorized behavior, storage, backup evidence and real visual UAT. On failure switch only ADFLICK to previous verified compiled release; do not auto-rollback schema.
