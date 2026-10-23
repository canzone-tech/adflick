# Batch 135 — Technician Workspace & Work-Order Evidence

## Integrated subset

Batch 135 source was recovered as an additive starter. The repository integrates the source-backed pure TypeScript policy subset under `apps/api/src/recovered-domain/b135`:

- technician work-order execution state transitions: check-in, start, block, resume, submit and cancel;
- required-checklist enforcement;
- explicit `NOT_APPLICABLE` handling for completed required checklist items;
- failed required checks routed to independent verification rather than normal completion;
- evidence upload-state gate before normal submission;
- evidence metadata validation for file count, byte limits, duplicate IDs, MIME allow-list and unsafe path/control-character names.

## Deliberately not integrated

The supplied React workspace, Prisma fragment and API contract are retained as recovery evidence only. The source README states they are uncompiled/unconnected starters and requires server-derived tenant/technician scope, transactional/idempotent state changes and private object storage with authenticated short-lived upload URLs. Those concerns require canonical NestJS/Prisma integration and migration validation before activation.

No compensation, payment, device-health or independent-verification business rule is inferred from this batch.

## Verification intent

Jest acceptance tests cover the integrated policy subset. CI remains authoritative for repository-wide validation; local `npm run verify --all` remains the final local gate and production approval is separate.
