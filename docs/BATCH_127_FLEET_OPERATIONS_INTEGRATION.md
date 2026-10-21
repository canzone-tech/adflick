# Batch 127 — Fleet Operations Policy Integration

## Integrated scope
- Typed incident statuses and SLA alert contracts under `apps/api/src/recovered-domain/b127/`.
- Incident transition validation requires an actor, rejects invalid transitions, and requires a reason for resolve/close.
- Alert inbox policy filters by tenant, severity, status, and search, then sorts by severity and recency.
- Escalation policy is a deterministic proposal helper with validation for age threshold, enabled rule, attempt configuration, duplicate attempts, and terminal incident states.
- Jest acceptance tests cover these policies and tenant isolation.

## Explicit limitations
This is a policy/helper integration only. It does not add NestJS controllers, database models/migrations, durable escalation workers, notification delivery, server-side pagination, persisted incident timelines, optimistic concurrency, or admin UI. The source Prisma fragment is intentionally not merged into the canonical schema without a separate MySQL 8.4 schema review and migration validation.

## Operational safety
Every production endpoint must enforce authentication, RBAC, and tenant scope server-side. Incident transition plus immutable timeline event must be transactional. Escalation requires durable idempotency, retry/backoff, suppression/quiet-hours handling, delivery receipts, and safe notification content before activation. No escalation rules are enabled by this helper itself.
