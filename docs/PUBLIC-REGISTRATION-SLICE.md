# Public Join Now: verified email account bootstrap (ADFLICK SRS v1.0)

**Status: partial technical integration. NOT full member registration.** Client SRS v1.0 §5.3 and Appendix B.1 specify **e-PIN, sponsor verified lookup, full name, mobile OTP, email, package, LEFT/RIGHT placement, password and consent**, with atomic e-PIN redemption/placement. No SMS OTP provider, mobile policy, spillover, public PIN transfer or approved financial activation is available. Do not misstate this partial slice as a complete SRS journey.

## What this unit actually does
- **Organization-scoped, default-deny** `PublicSignupPolicy` plus operator `ADFLICK_PUBLIC_SIGNUP_ENABLED=false`, `ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED=false`, and existing SMTP/email OTP gates.
- **Public GET** `/api/v1/public-signup/organizations/:slug` returns only active, enabled organization name and latest independently approved consent version, digest and actual legal document text. Disabled orgs never expose a signup form or unapproved legal text.
- **Public POST** `/api/v1/public-signup/start` accepts tenant slug, full name, email, password and explicit latest-version/hash consent. It stores Argon2id hash and HMAC-only OTP, sends numeric code via real TLS-enforced SMTP and returns a generic acknowledgment. Existing-user email gets same response shape with no mail, to reduce account enumeration. IP throttle + MySQL per-email cooldown/hourly cap.
- **Public POST** `/api/v1/public-signup/verify` checks unexpired numeric OTP (max 5 failures, timing-safe comparison) and atomically creates `User` ACTIVE + MEMBER role and immutable `AccountConsentRecord`. It does **not** create `MemberProfile`. Staged password/OTP data is deleted after successful verification. A real login session still needs the user's email/password.
- **Operator policy** `GET/PUT /api/v1/admin/public-signup/policy`: tenant scope, JWT + RBAC (SUPER_ADMIN/ORGANIZATION_ADMIN), MFA step-up for PUT, versioned optimistic concurrency and audit. Enabling a tenant policy never overrides operator/SMTP/legal gates.
- **Web `/join`** is a public route outside operations sidebar. Real tenant/legal lookup, consent, form submit, email challenge/verify; no fake approved package figures, mocked SMS success or compensation. Login links from the existing app allow continuing e-PIN enrollment only when independently approved.

## MySQL contract
- `PublicSignupIntent`: short-lived staged email/name/Argon2 hash + SHA256 HMAC OTP; state QUEUED→SENT→CONSUMED/FAILED, expire/attempt ceiling; no raw OTP stored.
- `PublicSignupThrottle`: tenant/email keyed cooldown and rolling hourly safety limit; MySQL authoritative across API instances (no Redis assumptions).
- `AccountConsentRecord`: immutable versioned approved legal document linkage and acceptance timestamp tied to real organization/user; distinct from the later member-specific `MemberConsentRecord`.
- `PublicSignupPolicy`: tenant-specific approval switch, default false, audited and versioned.
- Successful verification creates **account credentials, not activation, member ID, genealogy or e-PIN redemption**. No demo fixtures outside isolated CI tests; no default registration enabled.

## Security gates and operator decisions
SMTP sender/domain, SPF/DKIM/DMARC, inbox deliverability, retention/privacy policy, actual public registration authorization, mobile OTP provider/templates/cost/consent, e-PIN issuance authority, sponsor/spillover and member ID rules remain to be approved and tested. Public throttling is defense-in-depth and does not replace edge WAF or abuse monitoring. Staged application records require an approved retention/pruning policy; no unsupported auto-delete beyond successful verified accounts.

## Acceptance evidence
`apps/api/test/public-signup.mysql.e2e-spec.ts` runs against disposable local MySQL with actual loopback SMTP socket acceptance; it checks disabled default, tenant policy, legal hash, password hash, OTP wrong/replay, generic duplicate response, account/role/consent atomicity and server session login. Web CI covers new route and shared nav exemption. Exact-SHA CI, local verify, product/legal/provider UAT and production restore are separate gates.

## Signup lifecycle and consent-drift UX hardening (2026-10-28)

The public `/join` flow now clears stale organization/OTP/consent state on restart or lookup, blocks duplicate in-flight submits in its event handlers, and rejects a visibly expired verification request locally with a clear restart instruction. Backend expiration, HMAC OTP and MySQL replay checks remain authoritative—client time is only a convenience and never grants verification.

The real SMTP/MySQL registration acceptance suite now creates a newly approved test-only consent version after an OTP was issued against the earlier approved version. Correct OTP verification must fail with 409 and leave the staged request unconsumed, no new user/member/consent, and no success audit; submitting the outdated consent for another signup must fail 400. Actual legal approval, provider acceptance, full membership activation and production remain pending.
