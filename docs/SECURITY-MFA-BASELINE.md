# ADFLICK privileged MFA security baseline

## Source-backed classification

The canonical RBAC enum defines `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `ADVERTISER`, `SCREEN_OWNER`, `CONTENT_MANAGER`, `OPERATIONS_MANAGER`, `FINANCE_MANAGER`, `SUPPORT_AGENT`, and `AUDITOR_COMPLIANCE`.

For the privileged-mutation security gate, the implementation classifies these existing elevated operational roles as privileged:

- `SUPER_ADMIN`
- `ORGANIZATION_ADMIN`
- `OPERATIONS_MANAGER`
- `FINANCE_MANAGER`

This is a security classification derived from the existing RBAC and controller permissions, not a new commercial entitlement or payout rule. Business roles such as advertiser/content authoring remain governed by their existing RBAC permissions.

## Controls implemented

- TOTP enrollment with an encrypted-at-rest authenticator secret.
- One-time recovery codes stored only as hashes and replaced on rotation/recovery.
- Single-use, session-bound, time-bounded step-up challenges.
- Persistent attempt counting plus endpoint throttling for challenge abuse.
- Step-up state is stored on the authoritative MySQL refresh-session record and expires independently of the access-token lifetime.
- Every privileged `POST`, `PUT`, `PATCH`, or `DELETE` guarded by canonical RBAC requires a valid MFA step-up for a privileged role.
- Enrollment, confirmation, step-up success/failure, rotation and recovery are audit events without logging secrets or MFA codes.
- Rotation and recovery revoke other active sessions and require current-password proof; recovery also consumes exactly one recovery code.
- Conditional versioned database updates prevent concurrent enrollment/rotation/recovery and TOTP replay races.
- Logout/revocation invalidates step-up because the server rechecks the current refresh-session state on every privileged mutation.

## Configurable security controls

Defaults are conservative engineering controls and are configurable through environment variables:

- `MFA_STEP_UP_TTL_SECONDS=600`
- `MFA_CHALLENGE_TTL_SECONDS=300`
- `MFA_CHALLENGE_MAX_ATTEMPTS=5`
- `MFA_ENROLLMENT_TTL_SECONDS=900`
- `MFA_TOTP_STEP_SECONDS=30`
- `MFA_TOTP_WINDOW_STEPS=1`
- `MFA_RECOVERY_CODE_COUNT=10`

Production requires a dedicated `MFA_ENCRYPTION_KEY` containing 32 bytes encoded as base64url. Non-production verification/runtime helpers generate an ephemeral or local-only key and never commit it.

## Acceptance boundary

Issue #7 remains open until backend security tests, clean MySQL migration verification, real browser UAT, exact-SHA Backend/Frontend/Release Evidence CI, and the owner-confirmed local gate are green. This implementation does not authorize production deployment.
