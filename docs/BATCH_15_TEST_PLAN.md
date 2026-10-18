# BATCH 15 Test Plan

## Automated / CI checks
- Prisma schema validation and generated client compile.
- API typecheck, lint, unit tests and production build.
- Confirm MySQL migration creates the outbox indexes and unique event key.

## Required integration tests
1. Enqueue an incident twice: only one row for `incident.created:<incidentId>`.
2. Successful webhook: row transitions `PENDING -> PROCESSING -> DELIVERED`, `deliveredAt` populated.
3. HTTP 5xx / network failure: row returns to `PENDING` with a future `availableAt`, `lastError` populated.
4. Retry exhaustion: row transitions to `FAILED` after `maxAttempts`.
5. Stale lease: a `PROCESSING` row with old `lockedAt` can be reclaimed.
6. Two worker instances claim a single pending row: only one conditional claim succeeds.
7. Incident create/scan: incident and audit records remain present, notification enqueue is idempotent.
8. Webhook redirects are not followed and the existing HTTPS + host allowlist protections remain enabled.
9. Verify no code path converts accepted playback events directly into automatic payout.

## Release acceptance
- Apply migration to a disposable MySQL 8.4 database and run Prisma validation.
- Test webhook delivery/retry/recovery in staging with an idempotent receiver.
- Confirm operations can query FAILED rows and safely re-drive only after reviewing receiver idempotency.
- Review retention, privacy, and access control for stored payloads before production.
