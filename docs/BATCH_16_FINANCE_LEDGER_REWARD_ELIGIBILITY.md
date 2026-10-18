# BATCH 16 — Finance Ledger, Reward Eligibility & Maker–Checker

## Scope

Adds configurable organization-level reward policy, period-based screen-owner reward calculation, finance approval requests, a ledger of approved accruals, an API module, and a finance web page. The Prisma datasource remains **MySQL**. Amounts are stored as integer paise to avoid floating-point money arithmetic.

## Endpoints (JWT + role guard)

- `GET /api/v1/finance/reward-policy`
- `PATCH /api/v1/finance/reward-policy`
- `POST /api/v1/finance/rewards/calculate` — `{ "periodStart": "ISO-8601", "periodEnd": "ISO-8601" }`; start inclusive, end exclusive.
- `GET /api/v1/finance/rewards`
- `POST /api/v1/finance/rewards/:id/request-approval`
- `GET /api/v1/finance/approvals`
- `POST /api/v1/finance/approvals/:id/decision` — `APPROVED`, `REJECTED`, or `ON_HOLD` with optional note.
- `GET /api/v1/finance/ledger`

Read roles: Super Admin, Organization Admin, Finance Manager, Auditor/Compliance. Write roles: Super Admin, Organization Admin, Finance Manager. An organization context is required. Organization filtering is applied in service queries.

## Eligibility logic

- Counts only `PlaybackEvent` rows that the server previously marked `ACCEPTED`, with type `PLAY_COMPLETED` and a completion timestamp within the requested period.
- Requires an assigned screen owner and configured minimum completed plays.
- Computes campaign-linked play percentage as a conservative proxy; it is **not** a complete measure of campaign scheduling coverage.
- Holds unrecognized platform types for manual review.
- If a non-zero minimum uptime policy is configured, calculation is held because period-wide, trusted uptime evidence is not yet available.
- Policy values and effective date are snapshotted into each calculation. Re-running a period will not overwrite pending-approval, approved, rejected, or reversed records.
- Calculations do not themselves approve money or trigger payouts.

## Maker–checker and ledger

- Only positive `ELIGIBLE` calculations can be submitted for approval.
- The requester cannot decide their own approval.
- Approval decisions run in a database transaction. Approval creates one `REWARD_ACCRUAL` ledger row with a unique idempotency key and updates the calculation state.
- Rejected/held items do not create ledger entries. Ledger records are append-only through the exposed API; no ledger edit/delete endpoint is provided.
- Ledger accrual is an accounting record, **not** a payment instruction. There is no payout gateway integration in this batch.

## Known limitations / production gates

1. `RewardPolicy` currently stores one active policy row per organization. Editing it does not create a full policy version history; keep written policy approvals outside the system until policy versioning is implemented.
2. Platform classification relies on the stored platform strings. Verify device type during onboarding; ambiguous devices are held.
3. Playback event validation from the prior batch is not cryptographic proof that a real person viewed an ad. Add server-issued playback authorization, anti-replay controls, player integrity/anomaly detection, and manual fraud review before financial use.
4. Campaign-linked play percentage is only a proxy. Implement schedule-aware eligible inventory/campaign coverage before using it for contractual billing or reward adjudication.
5. Period-wide uptime is not calculated yet. If configured as a requirement, the record is held rather than guessed.
6. A ledger accrual does not perform bank transfers. KYC, tax, sanctions where applicable, disputes, payout approvals, provider idempotency and reconciliation require a separately secured payout module.
7. Database migration, generated Prisma client, TypeScript build, Jest and live MySQL tests must pass in CI before deployment.
