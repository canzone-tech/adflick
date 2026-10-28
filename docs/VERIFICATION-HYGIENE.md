# Verification hygiene and source provenance

## Current standard

`npm run check:source` runs canonical schema/package checks, executable contract-runner tests, the domain-named source contract suite and source-provenance checks, plus the shared UI shell check. A missing or failing contract fails the gate. Full `npm run verify` additionally runs deterministic install, lint/typecheck, unit and real MySQL HTTP/integration tests, migrations, compiled API readiness/401, production Next.js build and compiled route smoke.

The 35 old numbered **verification scripts** have been moved under `scripts/contracts/` using functional names and executed by `scripts/check-regression-contracts.mjs`. Their regression assertions have been retained; only wiring, location and diagnostic names changed. Their original archive/batch references remain available in Git history. `docs/BATCH-HISTORY.md` is an **audit archive**, not an implementation, sprint or release unit. Do not recreate numbered delivery/check scripts for new development; use features, domains, risk and SRS acceptance criteria.

The source-contract scripts are supplementary static checks and include legacy text/presence assertions. They do **not** prove actual authorization, state changes or payment safety. Relevant Jest and disposable MySQL tests must continue to run; migrate brittle checks to behavioral tests only when equivalent or stronger regression coverage exists.

## Known warning and coverage baseline (before this cleanup)

At previous exact SHA `3a55a2ca44ee6aafb375f8d72732683573a8de91`, Backend CI reported **75 ESLint `@typescript-eslint/no-explicit-any` warnings, 0 lint errors**. The majority are legacy test-double casts; production occurrences in delivery, devices, finance, reconciliation and playback need typed Prisma/DTO fixes with dedicated regression evidence. The lint rule remains enabled. These warnings are **open technical debt**, not a reason to mute lint or weaken compiler settings.

In the 28 October 2026 operator screenshot, `npm run verify` ended with `Verification PASS: --all`. Screenshots do not independently certify the local Git SHA; record `git rev-parse HEAD` for exact local parity if needed. The screenshot's Jest unit coverage summary showed approximately **39.46% statements / 41.12% lines** over the currently configured instrumentation scope. Coverage is not equivalent to acceptance of unapproved features; expand targeted tests in active high-risk services.

NestJS `AlertNotifierService` logged HTTPS/host rejection and a simulated 503 during **passing negative-path unit tests**. These are expected error-path assertions in the observed run, not evidence of a real provider outage. If similar errors arise outside the test harness, triage as an actual incident.

## Change and regression policy

- Prefer domain-oriented test names and a few purposeful verification stages rather than one script per imported archive.
- Keep original `docs/BATCH-HISTORY.md` and all Prisma migration history intact for provenance and audit.
- Do not silently delete assertions or replace runtime tests with textual searches.
- Do not suppress ESLint warnings merely to make output green. Fix typed mocks/production contracts in focused changes, with CI evidence.
- No SMS provider, compensation, payout-policy or deployment activation is authorized by verification refactoring.

## Local report readability

The root coverage script keeps Jest statement/branch/function/line measurements unchanged, writes detailed HTML and JSON-summary reports under `apps/api/coverage/`, and prints only the terminal text summary to avoid thousands of red per-file rows. Red percentages mean uncovered lines, not failed tests. Coverage thresholds have not been reduced and nothing is excluded from instrumentation. Alert webhook negative-path tests assert their expected Nest logger messages using a test-local spy; production HTTPS and host allowlist enforcement remains unchanged.

## Strict lint regression gate

Backend ESLint now uses `--max-warnings=0` in the existing workspace script, keeping `no-explicit-any` enabled. Jest and real MySQL checks remain required; the previously observed 75 warnings were traced to loose runtime types and isolated test doubles. Future unsafe casts must fail CI rather than silently accumulate.
