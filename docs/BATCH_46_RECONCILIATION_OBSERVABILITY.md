# Batch 46 — Reconciliation operational observability

## Delivered
- Stable failure classification for malformed statement data, lost processing claims, database availability failures, and unknown processing failures.
- Allow-listed operational event shape containing identifiers, elapsed milliseconds, aggregate counts, and stable error codes only.
- Unit tests covering classification and the event allow-list.
- The import service stores a stable `lastErrorCode` rather than a raw exception message.

## Operational contract
- Never log raw CSV contents, beneficiary data, provider references, credentials, access tokens, or raw exception text.
- Do not use organization IDs or import IDs as high-cardinality metric labels. Keep identifiers in access-controlled structured logs/traces only; metric labels should be bounded enums such as outcome and failure code.
- Alert on elevated failed imports, growing `RECEIVED` imports, expired processing leases, database errors, and discrepancy-rate changes.
- The helper defines a safe event schema; a production log/metrics exporter still needs to be wired to the deployment's approved observability provider.
- Reconciliation results never initiate payout transfers. Finance approval and payout release gates remain independent.

## Validation
Run `npm run check:source`, then install locked dependencies and run the focused Jest test. Run the existing finance HTTP E2E suite against a disposable MySQL 8.4 database before release. Static checks are not runtime certification.
