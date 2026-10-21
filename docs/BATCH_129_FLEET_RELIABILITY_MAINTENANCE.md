# Batch 129 — Fleet Reliability & Preventive Maintenance

## Integrated
- Reliability heuristic with sample-count guard, explicit data coverage and missing/invalid metric warnings.
- Trend comparison refuses low-sample comparisons and returns no percent change for a zero baseline.
- Maintenance window validation requires explicit ISO instants with an offset, valid IANA display timezone, tenant/device scope and end-after-start.
- Half-open overlap helper and maintenance task transitions; completion requires actor and evidence, with separate verification and audit requirement.
- Jest tests follow the repository runner; no source Prisma fragment was merged.

## Safety and decisions
The score is an operational heuristic, not a certified reliability metric. Weights and thresholds are inherited from the supplied starter and require operations review/approval before being surfaced as an authoritative score. Missing inputs are not treated as zero failures or perfect health. Heartbeat is not proof of ad playback or reward eligibility.

Overlap checks in this commit are pure helpers only. Production creation must enforce tenant RBAC and prevent concurrent overlap races using a reviewed MySQL transaction/locking strategy. Alert suppression must be restricted to explicitly approved alert codes and exact approved windows. Recheck device trust and command authorization at execution time; completion and post-maintenance verification remain distinct.

## Not included / pending
No NestJS endpoints, canonical Prisma models/migrations, persisted score snapshots, background recompute, bounded API pagination, transactional overlap protection, alert suppression integration, UI, load tests, or end-to-end UAT. Source Prisma fragments remain evidence only pending canonical MySQL 8.4 review.
