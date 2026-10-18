# BATCH 20 — Provider Acceptance Tests & Financial Release Gate

## Purpose
Establish explicit acceptance evidence for payment-provider integration and prevent accidental live transfer activation before engineering and finance sign-off.

## Added
- Provider callback envelope validation: event identifier/type, account allowlist, timestamp freshness and deterministic event digest.
- Safe SHA-256 digest comparison utility.
- Pure release-gate evaluator requiring Prisma validation, API/web builds, unit tests, MySQL 8.4 integration, provider sandbox, reconciliation, finance approval, approved production provider configuration and an explicit live-transfer release decision.
- Unit-test source and static checks.

## Important boundaries
The callback validator is supplementary: verify the provider's signature over the exact raw request body first. Do not treat a provider-supplied event timestamp as proof of authenticity. Use durable event uniqueness and transactional monotonic state transitions. Provider-specific documentation determines timestamp/header semantics.

The release gate is a policy evaluator, not a deployment switch by itself. The actual transfer service must enforce the result server-side and default to disabled. Do not trust browser settings or environment flags that a tenant administrator can modify.

## Acceptance scenarios
1. Valid signed fresh callback from configured provider account accepted for processing.
2. Invalid signature, stale callback, future timestamp outside clock skew, unexpected account and malformed envelope rejected.
3. Duplicate provider event ID is idempotently acknowledged without applying payout state twice.
4. Out-of-order callbacks cannot downgrade PAID/REVERSED states.
5. Timeouts trigger provider status query before retrying submission.
6. Unknown references and amount/currency mismatches go to manual exception review.
7. Release gate blocks if any test evidence or finance sign-off is missing.
8. Sandbox mode cannot be enabled as a production payment rail.

## Release verification
Run `npm run check:source`, `npx prisma validate`, API/web type checks, lint, Jest, production builds and integration tests against a disposable MySQL 8.4 instance. Retain signed release evidence and do not enable real transfers until all required gates pass.
