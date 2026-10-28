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

## Critical-path behavioral coverage expansion (28 October 2026)

Additional Jest cases now exercise existing **operational** identity and finance boundaries without changing business behavior:

- `auth.service.security.spec.ts`: uniform credential rejection, no session/audit on failure, refresh-token hashing, login metadata minimization, atomic refresh single-winner, revoked/expired sessions, bounded passwords and scoped logout.
- `mfa.service.security.spec.ts`: privileged-only session step-up, MFA enrollment requirement, cross-user/revoked/expired session denial, step-up TTL, challenge rate limit, OTP attempt counter, concurrent consumed-challenge guard and replay rejection.
- `finance.service.approval.spec.ts`: finance RBAC, tenant isolation, previously decided approval denial, transaction-scoped accrual audit ordering, reject-without-accrual and audit failure propagation. This tests the existing **screen-owner reward** approval flow, **not** SRS member binary commission or release approval.

These new tests run in the existing `test:api:coverage` stage; they do not replace MySQL security/finance/member integration tests or real-browser UAT. Coverage ratios are **not** artificially reweighted/excluded and no thresholds are relaxed. Unit transaction fakes assert predicates/order and failure propagation; only actual MySQL integration proves transactional rollback.

Before changing release or financial policy, independently review business-policy approval, actual provider UAT and recovery evidence. Do not use green tests to authorize payment, payout or deployment.

## MySQL enrollment and finance integrity regression expansion

The existing disposable-MySQL acceptance suites are extended in place, rather than introducing client-archive-specific test batches. `apps/api/test/enrollment.mysql.e2e-spec.ts` now verifies: recipient-bound PIN denial across authenticated members; independent email/phone OTP consumption guards; no PIN/profile/placement/consent/audit writes on missing proof; and the actual losing concurrent RIGHT-side request leaves both verified challenges, unused PIN and no member/phone binding or enrollment audit. Successful pending enrollment also verifies that no finance calculation, ledger or payout batch was generated.

`apps/api/test/finance-transaction.mysql.e2e-spec.ts` additionally tests the existing PayoutsService against real MySQL for cross-tenant reconciliation denial, reopening refusal after transition and unchanged stored audit/batch state. This remains **screen-owner finance**, not SRS member commissions; no provider, compensation, payout, or activation policies are enabled. Tests remain gated by `RUN_MYSQL_MEMBERS_E2E` / `RUN_MYSQL_FINANCE_E2E` on isolated non-production MySQL and are exercised by the root verification/CI gates.

These cases assert persisted state rather than merely checking HTTP response codes. They do not claim exhaustive security coverage, real SMS-provider UAT, commercial approval, or production recovery.

## Five SRS-aligned trust and UI regressions

The current member QA unit adds correct-but-expired public signup, email OTP and phone OTP rejection with persisted MySQL no-write/no-verify assertions; deliberately cyclic rooted-genealogy read denial (HTTP 409) with isolated fixture cleanup; and real Chrome responsive checks of the three member routes at 320/390/768/1280px. Existing Prisma migrations, production auth/OTP/finance policies and source-level checks remain unchanged. A correct test-gateway OTP is **not** an approved live SMS provider.

Unit-coverage percentages need not change because the acceptance slices primarily exercise HTTP/MySQL and browser UAT, which have separate gates. Exact SHA/run links must be recorded after CI completes; local verify remains user-confirmed only.

## Five combined member/product hardening milestones

One GitHub-first QA unit covers: (1) Member Dashboard role-first fetch; (2) Member Onboarding role-first fetch; (3) staff/member explicit retry and secure data clearing; (4) public Join expired-request and consent-drift guards; (5) real MySQL authenticated repeated reads plus Chrome guest/staff route isolation. `npm run verify` remains a single combined local gate after exact-SHA Backend CI, Frontend CI and Release Evidence PASS. No coverage thresholds, business rules, financial activation, mail/SMS integrations, production or migrations are altered.

## Member enrollment UI integrity follow-up

New state/version guards prevent stale in-flight lookup/preflight responses from reauthorizing a changed client form; server transactions still govern placement and e-PIN redemption. Admin PIN inventory uses real 25-row MySQL pages, with no bearer token in returned inventory. Issuance guards invalid future date input, while a successful mutation with subsequent failed refresh shows a warning rather than suggesting the PIN issuance itself failed. Existing disposable MySQL E2E adds invalid-expiry no-write and multi-page no-token/tenant denial checks. Chrome adds 360/412px handset regressions and Join overflow checks, preserving other breakpoints. No lint/coverage threshold, production config, schema, financial/provider policy, or business rules are changed.
