# ADFLICK SRS v1.0 — e-PIN + transactional pending enrollment

Functional SRS v1.0 scope approved. **External enrollment, paid activation, compensation and production enablement NOT approved.** This delivery extends the tested member foundation with real MySQL storage and non-financial transaction semantics. **Nothing is demo-provisioned into application databases.**

## Canonical models and endpoints

- `MemberPackage`: organization-specific code/name and DRAFT→ENABLED independent maker-checker transition; **no price, joining fee or commission implied**. `POST /api/v1/member-enrollment/packages`, `POST /packages/:id/approve`, `GET /packages`. Approver must be a different SUPER_ADMIN; elevated writes require real MFA step-up; approval reference is audit logged.
- `MemberConsentDocument`: versioned actual legal text, server-computed SHA-256, DRAFT→APPROVED maker-checker with approval reference. `POST /consents`, `POST /consents/:id/approve`, `GET /consents/current`; the member must accept the exact approved version/hash. Drafts cannot be consumed.
- `EnrollmentPin`: 256-bit random token shown **once**, keyed HMAC-SHA-256 persisted, recipient bound to one existing ACTIVE MEMBER user and organization. `POST /pins`, `GET /pins`, `POST /pins/:id/revoke`; listing never includes secret or hash. No transfer API exists (business authority/policy pending).
- `MemberConsentRecord`: immutable registration consent version/time, created in the **same MySQL transaction** as member+genealogy and PIN redemption.
- `POST /api/v1/member-enrollment/enroll`: **authenticated pre-provisioned MEMBER only**; JWT session binds user/tenant; input must include PIN, sponsor/placement member codes, side LEFT/RIGHT, exact approved consent digest/version and acceptance. Sponsor and parent must be ACTIVE in the same rooted genealogy; serializable transaction conditionally claims PIN and writes member (PENDING_ACTIVATION), sponsor, placement, consent, redemption audit. Concurrency/occupied side/reused PIN/cross-tenant/invalid consent cause rollback. Not a public signup, no OTP completion or earnings.
- No root bootstrap, sponsor transfer/correction, spillover, volume, pairing, member wallet or payout endpoints. Business decisions for root identity, PIN expiry/transfer, member public ID and OTP remain explicitly OPEN.

## Default-deny operator switches (all false unless explicitly approved)

```text
ADFLICK_MEMBER_CONFIG_ENABLED=false
ADFLICK_MEMBER_EPIN_ISSUANCE_ENABLED=false
ADFLICK_MEMBER_ENROLLMENT_ENABLED=false
ADFLICK_EPIN_HASH_PEPPER=[dedicated private secret, minimum 32 characters]
```

Feature switches do **not** constitute approval. Product/legal/finance signoffs, operator review, permissions and production/restore evidence remain necessary. PIN secret is never persisted in plaintext or logged. Test-only fixtures and feature switches are confined to isolated disposable MySQL 8.4 and are not customer demo data.

## Acceptance and important remaining gaps

New `apps/api/test/enrollment.mysql.e2e-spec.ts` runs through the same disposable MySQL test gate as member genealogy; validates maker–checker, tenant scoping, policy gates, one-time issuance, concurrent redemption and unique binary slot, revoke, expiry, legal-version/hash mismatch, audit and transactional rollback. Tests are real DB/API calls, not pure policy-only mocks.

SRS AT-01..AT-05 remain **PARTIAL**: atomic enrollment of an **existing authenticated MEMBER** is not full first-time registration, because publicly verified email/phone OTP, KYC, complete consent/legal review, root bootstrap and lifecycle policy approval are not implemented. Never present PENDING_ACTIVATION as active, paid or reward-qualified. MySQL is authoritative. Historic migrations untouched; this is an additive migration only.
