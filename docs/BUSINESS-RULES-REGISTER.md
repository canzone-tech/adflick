# ADFLICK business rules register

| Concern | Source observation | Release status / owner decision |
| --- | --- | --- |
| Proof of play | Playback event source, device checks and duplicate protection exist in Batch-50 candidate | Rules/thresholds, real player delivery and offline replay UAT **NOT ACCEPTED** |
| Owner rewards | Engineering guide proposes up to ₹1,000 / eligible TV / month and ₹333 / eligible smartphone / month, conditionally | **PROPOSED ONLY** — written policy/version, targets, fraud/eligibility/approval rules required before enabling |
| Finance ledger | Batch-50 candidate includes MySQL ledger, maker-checker and reconciliation logic | Runtime MySQL/security/concurrency verification **PENDING**; no live payout |
| Provider transfer | Sandbox adapter exists; no live provider transfer authorized | **DISABLED** — provider UAT, approvals, recovery and production sign-off required |
| Campaign policies | Existing schema and CMS code contain campaign/schedule concepts | Priority/fees/content-owner constraints to be approved before changing behavior |
| Multi-tenancy | Tenant guards/tests present in source | CI DB-backed horizontal-access tests required; **PENDING** |

Never turn proposed demonstration values into guaranteed commercial terms.
