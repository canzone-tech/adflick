# ADFLICK email OTP and SMTP configuration — secure implementation

**Scope:** Client SRS v1.0 functional baseline approved 2026-10-27. This module provides real SMTP-backed **EMAIL OTP for existing authenticated MEMBER accounts**, bounded to pending e-PIN registration. It is NOT public signup, not SMS/phone verification, and not TOTP-based administrator MFA. All delivery and enrollment switches default OFF and require separate operator/legal/provider acceptance. No test mail or customer data is provisioned in an application environment.

## Settings / privileged API

- `GET /api/v1/member-enrollment/otp/policy`: SUPER_ADMIN/ORGANIZATION_ADMIN/AUDITOR_COMPLIANCE, tenant scoped. Returns only non-secret digits, TTL, resend cooldown, max attempts, version, emailEnabled, smtpReady and platformEnabled.
- `PUT /api/v1/member-enrollment/otp/policy`: SUPER_ADMIN/ORGANIZATION_ADMIN, JWT+MFA step-up, `ADFLICK_MEMBER_OTP_POLICY_ENABLED=true`; optimistic `expectedVersion`, audit on mutation. Policy limits: digits 6–8, TTL 120–900s, resend 30–300s, maxAttempts 3–8. Disabled by default until independently enabled.
- `POST /api/v1/member-enrollment/otp/request`: existing JWT MEMBER without profile; enabled policy + SMTP; system-generated cryptographic numeric OTP sent only to the registered account's email. 429 on cooldown/hourly limit and 503 on real SMTP delivery failure; no OTP in response/log/DB plaintext.
- `POST /api/v1/member-enrollment/otp/verify`: authenticated same tenant/member, challengeId+code; HMAC comparison with timingSafeEqual; 3–8 attempts; verified state expires.
- `GET /api/v1/member-enrollment/otp/status`: member's own verification status only.
- Existing `POST /api/v1/member-enrollment/enroll` now REQUIRES one unexpired verified email OTP and conditionally consumes it inside the same serializable MySQL transaction as PIN, member, sponsor, placement, consent and audit. Any placement collision rolls OTP/PIN claims back.

## SMTP configuration (server-side only; not editable in browser)

| Env var | Meaning |
| --- | --- |
| `ADFLICK_SMTP_ENABLED=false` | Master email transport gate |
| `ADFLICK_SMTP_HOST` | SMTP hostname |
| `ADFLICK_SMTP_PORT=587` | STARTTLS on 587, or TLS 465 |
| `ADFLICK_SMTP_SECURE=false` | True for implicit TLS 465; false for **mandatory STARTTLS** |
| `ADFLICK_SMTP_USERNAME` / `ADFLICK_SMTP_PASSWORD` | Provider credentials, from secret manager only |
| `ADFLICK_SMTP_FROM_EMAIL` / `ADFLICK_SMTP_FROM_NAME` | Valid sender identity |
| `ADFLICK_MEMBER_EMAIL_OTP_ENABLED=false` | OTP issuance/verification master gate |
| `ADFLICK_MEMBER_OTP_POLICY_ENABLED=false` | Privileged policy mutations master gate |
| `ADFLICK_MEMBER_OTP_HASH_PEPPER` | Dedicated HMAC secret >=32 characters (separate from JWT/e-PIN) |
| `ADFLICK_MEMBER_OTP_HOURLY_CAP=10` | Safety rate limit, 1–20/hour |
| `ADFLICK_SMTP_INSECURE_LOOPBACK_TEST=false` | ONLY for isolated NODE_ENV=test loopback SMTP acceptance; do not enable on server |

TLS peer validation is always active; no `rejectUnauthorized=false` fallback. No SMTP password is returned by APIs, saved in MySQL, committed to repo, or printed in logs. The sender is limited to environment config (never arbitrary user recipient input).

SMS OTP is **not silently simulated**: no SMS gateway/provider approved or configured. Add a separate SMS adapter only when provider, templates, consent, costs, opt-out, abuse policy and UAT are accepted.

## Data integrity and evidence

New MySQL models `MemberOtpPolicy`, `MemberEmailOtp` and `MemberEmailOtpThrottle`: tenant/user composite FKs, cooldown/hourly request count, hashed single-use challenge, status SENT/VERIFIED/CONSUMED/FAILED, expiries, attempt counter, audit. Request invalidates older challenges. Delivery status SENT means remote SMTP server **accepted**, not guaranteed final inbox delivery. On provider failure, challenge remains FAILED, never SENT.

`apps/api/test/member-email-otp.mysql.e2e-spec.ts` uses a real loopback test SMTP socket and real disposable MySQL rows; separately verifies negative wrong-code, resend, race/attempt/tenant and SMTP failure behavior. Existing `enrollment.mysql.e2e-spec.ts` seeds VERIFIED challenge fixtures *only within disposable test DB* to prove atomic consumption/rollback; no production seeding is authorized.

## Remaining product blockers

No public Join Now/OTP signup, SMS OTP provider, email change verification, KYC or member activation provider, password reset mail, financial policies, legal consent signoff, physical SmartTV player and production recovery. Before enabling, review SMTP sender SPF/DKIM/DMARC, provider credentials and quotas, network egress, deliverability and independent real-mailbox UAT. Exact-SHA CI + local verify do not authorize production.
