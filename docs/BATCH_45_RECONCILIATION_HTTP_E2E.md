# Batch 45 — Reconciliation Import Authenticated HTTP E2E

## Scope

Batch 45 adds an opt-in HTTP-level end-to-end suite for the real NestJS application and MySQL-backed Prisma service. The tests exercise the controller, JWT/session validation, role guard, tenant-scoped read service, response serialization, and pagination validation together rather than mocking the reconciliation service.

## Coverage

- Unauthenticated import detail and row requests return HTTP 401.
- Finance Manager reads the import metadata and persisted discrepancy rows over HTTP.
- Auditor/Compliance has read access; Advertiser is denied finance reads and processing writes with HTTP 403.
- An organization cannot retrieve another organization's import or rows; those requests return HTTP 404.
- Invalid page sizes and offsets return HTTP 400.
- Fixture row counts for both organizations remain unchanged after rejected requests.

## Run against disposable MySQL 8.4 only

1. Use a disposable, local MySQL 8.4 database with migrations already deployed.
2. Set `DATABASE_URL` to a `mysql://` connection using `localhost` or `127.0.0.1`.
3. Set `JWT_ACCESS_SECRET` to a random secret of at least 32 characters.
4. Run `RUN_MYSQL_FINANCE_E2E=1 npm run test:e2e:finance -w apps/api`.

The suite intentionally refuses non-MySQL and non-local database URLs. Do not point integration tests at production or a shared database. The test suite is skipped unless `RUN_MYSQL_FINANCE_E2E=1` is explicitly set.

## Safety boundaries

This batch validates read endpoints and role-gates the processing route. It does not enable payouts, modify payout statuses, call payment providers, or certify financial settlement. The HTTP test uses seeded completed imports and persisted rows; it does not claim that live provider transfers are tested.

## Known release gates

- Execute Jest E2E suite in a provisioned MySQL 8.4 environment.
- Run `npx prisma validate`, API/web typechecks, lint, full unit tests, and production builds.
- Review migration application and fixture cleanup on the supported deployment environment.
- Keep live transfers disabled until separate provider sandbox, reconciliation, security, and finance approval gates are complete.
