# ADFLICK — provider-neutral SMS and phone-OTP security contract

**Status: implemented in GitHub as a default-DENY, non-paying technical integration. Real SMS provider approval, DLT/telecom policy/templates, sender authorization, privacy retention and live handset UAT are NOT granted or implied.**

## Architecture and endpoints

- NestJS `SmsGatewayService` uses Node.js built-in `fetch` with an **environment-only HTTPS** endpoint, Bearer authentication, 8-second timeout, JSON request and strictly validated acceptance response. No sample gateway credentials, fallback mock API or provider default is shipped.
- Required adapter request: `POST {to: E164, message: approvedTemplate, senderId, reference}` with Bearer token header. Required accepted response: `{"accepted":true,"messageId":"provider-reference"}`. A real vendor must explicitly support or be adapted to this contract and pass live UAT before enablement. HTTP acceptance proves the gateway accepted a send request, **not phone delivery**.
- `POST /api/v1/member-enrollment/phone/request` (JWT MEMBER) requires explicit SMS consent, E.164 phone, eligible non-enrolled account and full provider configuration; generates six-digit CSPRNG OTP, stores HMAC only, encrypts the E.164 number using AES-256-GCM, and records MySQL per-account/per-phone throttles. Earlier unconsumed phone challenges are invalidated. Server never trusts user-supplied OTP/delivery status.
- `POST /api/v1/member-enrollment/phone/verify` (JWT MEMBER) enforces current user+tenant+challenge+expiry, constant-time comparison, max attempts, atomic status transition and audit. Wrong/replayed/expired/cross-tenant codes cannot mark phone verified.
- `GET /api/v1/member-enrollment/phone/status` (JWT MEMBER) returns only masked phone last four, challenge status, expiry, resend time and provider-ready flag; no plaintext number or code.
- `GET /api/v1/member-enrollment/phone/configuration` (staff) discloses only non-secret readiness flags.
- `POST /member-enrollment/preflight` now requires a real VERIFIED unexpired phone challenge, alongside email OTP, e-PIN, approved consent and same-tenant sponsor/side. The final `POST /enroll` consumes both OTPs and e-PIN in one serializable MySQL transaction, writes pending membership and a `VerifiedMemberPhone` proof with ciphertext and timestamp. No phone/email verification by itself activates MLM membership or compensation.
- `/phone-verification` is an authenticated member page with pending-challenge recovery, SMS consent and error/rate-limit feedback. `/communications` shows staff readiness, `/member-onboarding` requires the new proof. All share the canonical topbar/sidebar.

## Runtime settings (server secrets only)

```text
ADFLICK_MEMBER_PHONE_OTP_ENABLED=false
ADFLICK_SMS_ENABLED=false
ADFLICK_SMS_PROVIDER_APPROVED=false
ADFLICK_SMS_GATEWAY_URL=
ADFLICK_SMS_GATEWAY_BEARER_TOKEN=
ADFLICK_SMS_SENDER_ID=
ADFLICK_SMS_OTP_TEMPLATE=  # approved copy with {code} and {minutes}
ADFLICK_MEMBER_PHONE_OTP_TTL_SECONDS=300
ADFLICK_MEMBER_PHONE_OTP_RESEND_SECONDS=60
ADFLICK_MEMBER_PHONE_OTP_MAX_ATTEMPTS=5
ADFLICK_MEMBER_PHONE_OTP_HOURLY_CAP=10
# ADFLICK_MEMBER_PHONE_OTP_HASH_PEPPER=<dedicated secret, min 32 chars>
# ADFLICK_MEMBER_PHONE_DATA_KEY=<AES-256-GCM 32-byte base64url key>
ADFLICK_SMS_INSECURE_LOOPBACK_TEST=false
```

The application rejects missing provider approval, template, sender, token, HMAC secret and encryption key. No auto-approval or UI secret editing. HTTPS is mandatory in normal runtimes with certificate verification; local HTTP is allowed **only** in isolated NODE_ENV=test loopback acceptance. Provider endpoints must be reviewed for approved destination, egress, DLT/templates and opt-in. Approved operational key rotation and retention/pruning policies are still open decisions.

## Evidence and limitations

`test/member-phone-otp.mysql.e2e-spec.ts` exercises a real loopback HTTP JSON gateway, actual MySQL records and JWT route behavior, including provider-disabled, consent, wrong/cross-tenant/replay/duplicate, gateway rejection and masking. `test/enrollment.mysql.e2e-spec.ts` supplies VERIFIED challenges **only within disposable test MySQL** to validate atomic phone+email+PIN consumption and rollback. Test server and sample phone number are not deployed or seeded into application.

**Not yet accepted:** provider-specific authentication contract, phone number change, sender/domain/telecom registration, legal/commercial template, opt-out/compliance policy, deliverability, fraud risk rules, public full-SRS atomic join, KYC/activation or financial posting. Explicit product/provider/operator approval remains required even after exact-SHA CI and local gates pass.
