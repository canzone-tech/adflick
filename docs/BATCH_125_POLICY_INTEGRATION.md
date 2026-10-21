# Batch 125 — Command Center Policy Integration

## Integrated in this slice
- Command lifecycle vocabulary and explicit state-transition policy.
- Monotonic event-sequence guard; duplicate/old events are idempotently ignored.
- `DELIVERY_UNKNOWN` remains reconcilable and is not treated as success/failure.
- Bulk-command preview defaults to dry-run, enforces a configurable selection limit, rejects duplicate device IDs, and returns explicit per-device eligibility reasons.
- Bulk preview always marks independent approval as required.

## Security and integration boundary
These are pure policy helpers and Jest tests only. They do not persist command events, authorize or dispatch real device commands, provide a tenant-scoped API, implement cursor replay, use Socket.IO/outbox, or provide the command dashboard UI. The canonical Prisma schema was not changed because the recovered Batch 125 schema is an additive fragment requiring relationship and migration review against the existing model.

Production integration must derive tenant and device trust from persisted server-side records, re-check Batch 124 authorization at enqueue and immediately before execution, persist state/event changes transactionally, enforce rate/concurrency limits, and make reconnect clients fetch a canonical snapshot plus durable cursor events. Client-provided eligibility flags must never be trusted.

## Validation
Jest acceptance tests cover lifecycle transitions, invalid sequence values, duplicate/old events, delivery-unknown reconciliation, unsafe bulk candidates, duplicate selections, and selection limits. CI on the resulting exact commit SHA is required; local root verification is a separate user-confirmed gate.

## Status
Policy slice only; canonical API/Prisma/queue/UI/device integration and production acceptance remain pending. Production remains NO-GO.
