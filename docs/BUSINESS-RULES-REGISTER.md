# Client SRS v1.0 functional scope approval — 2026-10-27

The project owner explicitly approved **ADFLICK Binary 1:1 MLM + Advertising Platform SRS v1.0 as functional development scope** in this conversation. Client-supplied SRS is dated 2026-10-23 and originally labelled Draft. This approval covers *what to build* (public site, members, sponsor/placement, e-PIN, packages, binary matching, role portals and advertising). It is **not** sign-off of earning amounts, compensation rates/formulas, tax treatment, refunds, paid e-PIN/package sales, payouts, compliance or deployment. All such features remain disabled pending their own signed versioned policy and independent legal/finance review.

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

## Confirmed client device/platform scope — 2026-10-29 (non-financial)

The project owner explicitly confirmed that ADFLICK advertising playback must target **Android mobile/tablet, Android TV/Android-based Smart TVs, iOS/iPadOS, Samsung Tizen, LG webOS, Windows and Linux**. All are client-required product targets, not merely optional platform dropdown labels. This clarifies the product delivery scope; it **does not authorize new monetary/eligibility/payment rules**, infrastructure or production.

Source confidence: project-owner-confirmed client requirement in chat; a verbatim clause from the original SRS DOCX has not been independently re-read. Tracking IDs and per-platform status: `docs/CLIENT-PLATFORM-SUPPORT.md`. Native build, OS version/minimum device, real playback/field UAT and release approval remain independent for each platform. Do not confuse Android-only Flutter source or a MySQL screen row with completed cross-platform support.
