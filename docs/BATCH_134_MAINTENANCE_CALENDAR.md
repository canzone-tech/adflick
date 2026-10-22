# Batch 134 — Maintenance Calendar & Technician Scheduling

## Integrated subset

The supplied Batch 134 source is an additive starter for a maintenance calendar, technician scheduling and conflict-resolution flow. The repository integrates the source-backed pure TypeScript subset only:

- responsive calendar filtering/sorting model;
- duration calculation with malformed-interval guard;
- IANA timezone validation using the runtime timezone registry;
- technician active/skill/availability checks;
- tenant-scoped technician/device/planned-downtime conflict detection;
- read-only schedule proposal construction with blocking-conflict confirmation guard;
- Jest acceptance coverage for the above policies.

The supplied React `MaintenanceCalendar.tsx` component is **not** blindly integrated because the source README says it is uncompiled/unexecuted and requires a Tailwind setup that is not established as a production dependency in the current web application. The supplied Prisma fragment is likewise retained as recovery evidence, not merged into the canonical schema.

## Safety boundaries

- Preview/proposal helpers are read-only and do not reserve resources.
- Final schedule mutations must re-read tenant scope, technician state, availability and conflicts at confirmation time.
- Confirmation must repeat conflict checks inside a concurrency-safe database transaction or equivalent locking/constraint strategy.
- Schedule mutations require idempotency keys, audit events and a transactional outbox according to the recovered API contract.
- Planned downtime remains distinct from observed device-offline time and must not automatically alter campaign delivery or owner reward eligibility.
- ISO 8601 instants and explicit IANA timezone context are required; recurring local-time behavior must use a timezone-aware date library rather than fixed 24-hour increments across DST.

## Pending canonical integration

NestJS routes, canonical Prisma models/migrations, transactional double-booking protection, API authorization/RBAC, idempotent schedule/reschedule persistence, outbox/audit persistence, browser accessibility tests and real calendar UAT remain pending. This batch does not authorize production use.
