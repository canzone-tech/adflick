# Batch 27 — MySQL-Backed Security HTTP E2E

## Scope
Batch 27 adds a real NestJS HTTP integration test suite that connects to the configured MySQL database and exercises the JWT strategy, persisted session validation, and role guard through an actual HTTP request.

### Test file
`apps/api/test/security.e2e-spec.ts`

Coverage:
- No bearer token on a protected route returns 401.
- An organization administrator with an active database-backed session can access the admin-check route.
- An advertiser is denied by the route role policy with 403.
- A token backed by a revoked database session returns 401.
- Test fixtures create two organizations and users in the disposable test database and attempt cleanup.

## Safe execution
The suite is **opt-in** and is skipped unless `RUN_MYSQL_SECURITY_E2E=1`. It refuses a non-MySQL `DATABASE_URL` and requires `JWT_ACCESS_SECRET` of at least 32 characters. Never point this suite at production.

From repository root:
```bash
npm ci
npx prisma generate
npm run db:deploy
RUN_MYSQL_SECURITY_E2E=1 npm run test:e2e:security
npm run check:source
```

CI sets the opt-in flag, provisions `mysql:8.4`, applies migrations, and runs the suite. Confirm the GitHub Actions run is green before treating this test as executed successfully.

## Boundaries
This suite validates HTTP authentication/authorization for the `access/admin-check` route. It is not a substitute for comprehensive tenant isolation across campaign, CMS, device, incident, playback, finance, payout and export routes. Those still need dedicated MySQL-backed before/after persistence assertions, nested-resource tests and concurrency tests.

## Finance / playback release conditions
- Device-reported playback remains untrusted evidence, not sufficient by itself for advertiser billing or owner rewards.
- Reward payments remain conditional on configured thresholds, verified event quality, fraud review and finance approval.
- Live transfers must stay disabled until the actual transfer path enforces the release gate and the provider sandbox, reconciliation, finance, security and MySQL integration evidence is accepted.
