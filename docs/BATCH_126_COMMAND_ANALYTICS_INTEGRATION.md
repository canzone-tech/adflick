# Batch 126 — Fleet Command Analytics & SLA Policy Helpers

## Integrated from source

- Typed command observations and KPI contracts under `apps/api/src/recovered-domain/b126/`.
- Completion/failure rates use the shared terminal denominator `COMPLETED + FAILED`; `DELIVERY_UNKNOWN`, pending and expired commands remain separate.
- Acknowledgement/completion latency uses server-provided dispatch and outcome timestamps, validates non-negative intervals, reports p50/p95/max, and counts partial/malformed/negative intervals separately.
- SLA evaluation is disabled when the policy is disabled, enforces a minimum sample size, validates policy values, filters observations to the requested tenant, and emits deterministic deduplication keys.
- Jest acceptance tests cover denominator semantics, insufficient data, invalid intervals, tenant scoping and disabled policies.

## Intentionally not wired yet

- No API controller, dashboard UI, database models, scheduled aggregation, persisted alerts, suppression workflow, acknowledgement/resolution audit trail, paging integration, or production SLA policy has been enabled.
- The source Prisma fragment is retained as recovery evidence and has **not** been merged into the canonical schema or migrated. Any future schema change must be reconciled with the canonical MySQL 8.4 schema and reviewed migration process.
- `breachPercent` is the source-defined allowed percentage of latency samples exceeding the configured millisecond threshold; the source also uses it as the maximum failure percentage. Operations/product owners must approve whether these semantics should remain shared or be split before any SLA policy is enabled.
- API callers must still enforce tenant-scoped RBAC, bounded indexed queries, reporting timezone/window, cursor pagination, export permissions and audit requirements.

## Acceptance still pending

- Canonical API/controller and dashboard integration with tenant isolation tests.
- MySQL 8.4 migration review and integration tests if persisted snapshots/policies/alerts are approved.
- Unique database-backed alert deduplication, suppression, acknowledgement, resolution and audit persistence.
- Performance/accessibility tests at expected fleet scale.
- Operations approval of SLA thresholds, paging rules, retention and reporting timezone.
- Real device command telemetry validation. These KPIs are software/device command signals, not proof of ad viewing or human attention.
