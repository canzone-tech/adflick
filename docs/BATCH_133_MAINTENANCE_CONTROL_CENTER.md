# Batch 133 — Maintenance Control Center recovery

## Source-backed integration

Batch 133 supplies a Next.js/React maintenance dashboard starter covering plan filters, alert filters, telemetry coverage disclosure, run-history presentation, and a two-stage automation preview/confirmation UI contract.

The recovered UI source explicitly states that it is not connected to a running API and has not been compiled or browser-tested. The repository's current web app does not yet have the source bundle's Tailwind setup, so the component is preserved as recovery evidence rather than copied into the live page.

The safe canonical integration in this batch is the framework-neutral dashboard model under `apps/api/src/recovered-domain/b133/`:

- typed plan, alert, automation-run and dashboard snapshot structures;
- tenant-agnostic search/status/severity filters as pure presentation-domain helpers;
- KPI summarization for active plans, due plans, open alerts and failed/partial runs;
- telemetry coverage clamped to 0–100% before presentation;
- Jest acceptance tests derived from the supplied Batch 133 acceptance source.

## Deliberately not integrated

The supplied API routes remain proposals. No NestJS controller, Prisma migration, queue/outbox write path, Socket.IO wiring, or production page route is added here. The source requires server-derived tenant scope, RBAC, bounded manual runs, idempotency, transactional outbox behavior and server-side revalidation; those controls require canonical application integration and must not be inferred from the UI starter.

The dashboard UI's browser behavior, accessibility, loading/error/stale states and real API wiring remain UAT work. Alerts remain informational signals and must not automatically stop playback, campaigns or payouts.

## Acceptance position

Batch 133 is partially recovered: the source-backed dashboard decision model and acceptance tests are integrated. Production UI/API readiness is **not** claimed.
