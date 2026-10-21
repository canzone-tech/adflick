# Batch 130 — Maintenance Operations Policy Integration

## Source-backed scope
Based on `ADFLICK_PLAYOUT_BATCH_130_SOURCE.zip`: maintenance-window scheduling contracts, work-order state policy, reminder proposals and operational summaries.

## Integrated
- `apps/api/src/recovered-domain/b130/types.ts`: recovered window/work-order contracts.
- `scheduling.ts`: explicit ISO instants, IANA timezone validation, approval gate, tenant/device-scoped overlap preflight, half-open interval semantics.
- `work-order-state.ts`: transition allowlist, actor requirement, blocked/cancel reason, completion summary/evidence, independent verification and high-impact evidence checks.
- `reminders.ts`: deterministic, tenant-scoped reminder proposals and idempotency keys.
- `operations-summary.ts`: work-order counts, overdue/unassigned and completion awaiting verification.
- `b130.spec.ts`: policy acceptance tests.

## Safety and integration boundary
These are pure policy helpers; they do not claim that maintenance operations are wired into canonical NestJS routes, Prisma persistence, private evidence storage, a durable outbox, or the admin UI. A caller must derive tenant scope from the authenticated principal and enforce authorization server-side. Scheduling overlap must be rechecked inside a concurrency-safe MySQL transaction immediately before commit; this helper alone cannot prevent races. Reminder proposals must be persisted through a durable outbox before delivery. Planned downtime and observed heartbeat/playback downtime must remain separate metrics.

No Prisma fragment was merged and no migration was created: the recovered Prisma source is only a fragment and requires canonical schema review. No business SLA, fees, payout, or production policy was introduced.

## Acceptance still pending
- Canonical API/DB/outbox/UI wiring and tenant authorization integration tests.
- MySQL disposable migration validation, overlap race/concurrency tests, timezone/DST edge tests and load testing.
- Real operator UAT and production readiness evidence.
