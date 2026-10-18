# BATCH 18 — Provider Integration Safety & Reconciliation

### BATCH 18 additions
- Provider adapter contract with explicit idempotency-key requirement; no live transfer provider enabled.
- HMAC-SHA256 webhook signature helper using the exact raw request body and constant-time comparison.
- MySQL `ProviderWebhookEvent` registry with unique provider event IDs and payload hashes for deduplication.
- Strict CSV statement parser for integer-paise amounts, supported statuses, malformed input and duplicate-row rejection.
- Provider integration security guide and acceptance test plan.

# ADFLICK PLAYOUT CMS — BATCH 16
## Automated QA, CI/CD & Production Readiness

Cumulative source archive: BATCH 01–13 (includes BATCH 01–12).

### BATCH 13 additions
- GitHub Actions CI for MySQL 8.4, Prisma validation/generation, TypeScript, lint, API tests and production builds.
- Dependency review workflow for pull requests.
- Static source guard ensuring Prisma remains on MySQL and migrations have SQL files.
- Environment validation for required database/JWT secrets and production placeholders.
- Separate API liveness (`/api/v1/health`) and dependency readiness (`/api/v1/ready`) probes.
- Release checklist and explicit test plan.

### BATCH 12 additions
- Strict explicit CORS origin allowlist with comma-separated `WEB_ORIGIN` values.
- Rate limits on login and refresh endpoints.
- Webhook hostname allowlist, HTTPS enforcement, URL credential/fragment rejection and redirect refusal.
- Incident terminal-state hardening and webhook adapter unit tests.
- Security and production acceptance test plan.

### BATCH 11 additions
- Shared browser API client with bearer token and refresh-token rotation.
- Login page connected to the existing NestJS authentication API.
- Player health dashboard connected to fleet and health-summary endpoints.
- Health actions queue real player commands through the fleet API.
- Incident dashboard connected to incident list, summary, scan and lifecycle endpoints.
- Scheduled health alert scan added to the existing scheduler.
- Optional HTTPS incident webhook adapter with server-side bearer-token support.
- Environment settings and acceptance test plan.

### Local setup
1. Copy `.env.example` to `.env` and replace all placeholder secrets.
2. Start dependencies: `docker compose up -d mysql redis minio`.
3. Install packages: `npm install`.
4. Generate Prisma client: `npm run db:generate`.
5. Apply migrations: `npm run db:migrate`.
6. Seed local development data if appropriate: `npm run db:seed`.
7. Start API: `npm run dev:api`.
8. Start web: `npm run dev:web`.
9. Open `http://localhost:3000/login`, sign in with an active database account, then visit `/health` and `/incidents`.

### Environment settings
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`
- `SCHEDULER_ENABLED=true`
- `SCHEDULER_INTERVAL_MS=60000`
- `ALERT_SCAN_ENABLED=true`
- `ALERT_WEBHOOK_URL=
- `ALERT_WEBHOOK_ALLOWED_HOSTS=hooks.example.com`
- `ALERT_WEBHOOK_BEARER_TOKEN=`

### Operational safety
- Run a single API replica while the scheduler uses in-process coordination.
- Browser tokens currently use local storage; move to HttpOnly cookie sessions before production.
- Webhook URL must use HTTPS and its exact hostname must be listed in `ALERT_WEBHOOK_ALLOWED_HOSTS`.
- Player health telemetry is not trusted attestation.
- Optional HTTPS webhook delivery is available when `ALERT_WEBHOOK_URL` is configured; email/SMS/WhatsApp/push remain unimplemented.
- Before release, run `npm run verify:release` with dependencies installed and a reachable MySQL 8.4 instance. CI has been configured but is not considered green until executed in GitHub Actions.
- Production image publishing/deployment approvals, distributed scheduler locking, durable notification outbox/retries, backup automation and restore drills remain pending.

### Batch 13 verification commands
```bash
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

See `docs/BATCH_13_CI_CD_PRODUCTION_READINESS.md` and `docs/BATCH_13_TEST_PLAN.md`.

## BATCH 14 — Deployment, Observability & Recovery

See `docs/BATCH_14_DEPLOYMENT_OBSERVABILITY_RECOVERY.md` and `docs/BATCH_14_TEST_PLAN.md` for production-oriented Dockerfiles, Compose overlay, and MySQL backup/restore scripts. These are deployment artifacts, not proof of a completed live deployment. Validate the Compose file, build images, and perform a disposable-database restore drill before production use.


## Batch 15 — durable notifications and controls

Batch 15 adds a MySQL-backed notification outbox with idempotent enqueue, worker claims, exponential retry, stale lease recovery, and audit events for delivery outcomes. See `docs/BATCH_15_MONITORING_AUDIT_FINANCIAL_CONTROLS.md` and `docs/BATCH_15_TEST_PLAN.md`. Apply migrations before enabling the worker. Delivery is at-least-once; no automatic payouts are enabled.

## Batch 15 — durable notifications and controls

Batch 15 adds a MySQL-backed notification outbox with idempotent enqueue, conditional worker claims, exponential retry, stale lease recovery, and audit events for delivery outcomes. See `docs/BATCH_15_MONITORING_AUDIT_FINANCIAL_CONTROLS.md` and `docs/BATCH_15_TEST_PLAN.md`. Apply migrations before enabling the worker. Delivery is at-least-once; webhook consumers should deduplicate. No automatic payouts are enabled.


## Batch 16 — Finance ledger, reward eligibility & maker–checker

- Configurable organization-level TV/smartphone reward amounts and valid-play thresholds.
- Period eligibility uses server-accepted completed playback events; under-target devices receive zero candidate reward.
- Unverified device types and unsupported uptime requirements are held for manual review.
- Finance approval is maker–checker: the requester cannot decide their own approval.
- Approved rewards create idempotent ledger accruals; no bank transfer or automatic payout is triggered.
- New finance API and `/finance` web workflow, MySQL migration, audit events and tests.
- Important limitation: campaign-linked play percentage is only a proxy for schedule coverage. Playback events are not cryptographic proof of human viewing. Do not use this alone for contractual billing or payout decisions.

See `docs/BATCH_16_FINANCE_LEDGER_REWARD_ELIGIBILITY.md` and `docs/BATCH_16_TEST_PLAN.md`. Apply migration `202610140016_reward_ledger_maker_checker` only after reviewing it and testing against a disposable MySQL 8.4 database.


## Batch 17 — Payout reconciliation & disputes

Batch 17 adds a provider-neutral payout batch workflow, maker-checker approval, compliance attestations, export/submission recording, provider-result reconciliation, finance disputes, and a `/finance/payouts` review page. **No bank transfer or payment gateway call is performed.** See `docs/BATCH_17_PAYOUT_RECONCILIATION_DISPUTES.md` and `docs/BATCH_17_TEST_PLAN.md`.

Release gate: Prisma validation, client generation, TypeScript build, Jest and MySQL 8.4 migration/integration tests remain mandatory before production use.


## BATCH 19 — Sandbox provider and reconciliation matching

- Adds an in-memory sandbox payout adapter with stable idempotency and production-use guard.
- Adds a pure reconciliation matcher that flags unknown payouts, amount/currency/reference mismatches and status conflicts.
- Adds unit test sources and `scripts/check-batch19.mjs` static checks.
- No real money transfers or live provider calls are enabled. See `docs/BATCH_19_SANDBOX_PROVIDER_RECONCILIATION.md`.


## BATCH 20 — Provider acceptance and payment release gate
- Adds callback envelope freshness/account validation, digest comparison and a pure production release gate.
- Adds unit-test sources and static source checks. Does not enable live transfers.
- See `docs/BATCH_20_PROVIDER_ACCEPTANCE_RELEASE_GATE.md`.


## Batch 21 — Tenant Isolation & Production Acceptance

Batch 21 adds fail-closed organization-scope helper functions, focused Jest regression tests, a role/permission regression matrix, and a production acceptance checklist. See `docs/BATCH_21_E2E_TENANT_ISOLATION_PRODUCTION_ACCEPTANCE.md`. The helpers must be integrated at each relevant service boundary; this batch does not claim that every existing endpoint has already been audited or that the platform is production-certified. Keep live transfers disabled until all release evidence is complete.


## Batch 22 — Service-by-Service Tenant Isolation

Batch 22 adds organization-scoped mutation predicates across campaign, CMS, incident, finance, payout and playlist-assignment services, plus a tenant-isolation regression matrix. See `docs/BATCH_22_SERVICE_TENANT_ISOLATION_REMEDIATION.md`. Source checks are not a substitute for full NestJS/Jest/MySQL integration tests.


## Batch 23 — Automated Tenant Regression QA

Batch 23 adds service-level tenant-isolation Jest specs for campaigns, incidents and payouts, explicit Jest configuration, CI migration deployment to its disposable MySQL 8.4 service, and regression QA documentation. See `docs/BATCH_23_AUTOMATED_TENANT_REGRESSION_QA.md`. Specs are included but were not executed in the packaging environment because dependencies are not installed.


## Batch 24 — Authorization Coverage Expansion

Batch 24 adds service-level tenant-isolation tests for CMS, devices and playback reports and scopes the device status mutation by organization. See `docs/BATCH_24_AUTHORIZATION_COVERAGE_AND_REMEDIATION.md`. Tests are included but were not executed in the packaging environment because dependencies are not installed.


## Batch 37 — Concurrent finance reconciliation

The opt-in MySQL finance E2E suite now races two conditional state transitions and asserts exactly one persisted winner/audit. See `docs/BATCH_37_MYSQL_CONCURRENT_RECONCILIATION.md`. Run against disposable local MySQL 8.4 only.

## Batch 44 — Reconciliation Read API

Batch 44 adds tenant-scoped read-only endpoints for reconciliation import metadata and paginated statement outcomes. See `docs/BATCH_44_RECONCILIATION_READ_API.md` and `docs/BATCH_44_ACCEPTANCE_MATRIX.csv`. Read roles include Auditor/Compliance; write roles remain unchanged. The read APIs intentionally omit the raw CSV payload and do not settle payouts.
