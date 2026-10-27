# ADFLICK SRS v1.0 — Sponsor, placement and e-PIN UX integration

**Scope:** Client functional SRS baseline approved. This is the next **non-financial, pending-only** integration of the existing real API modules. We do not simulate enrollment, OTP delivery, payouts, activation or sponsor data.

## Member route /member-onboarding

The user must be an authenticated `MEMBER` account. The web screen reads `GET /member-enrollment/progress` (real member status, approved consent, unexpired verified email OTP, presence of issued recipient PIN and server enablement flag). It reads exact member codes from `GET /eligible/:memberCode` for active same-tenant sponsors and independently chosen placement parents; only LEFT/RIGHT availability and member code are disclosed. The parent/sponsor must be connected to the tenant's configured binary tree root, else generic 404.

The member enters a one-time PIN, selects a free side, accepts the exact approved legal text/hash, and triggers `POST /preflight`. That endpoint checks the real PIN hash, session/tenant binding, OTP, consent, status, sponsor, parent, root and current side. **No record is reserved or consumed** by preflight. Explicit submission uses the existing `POST /enroll` serializable MySQL transaction to atomically consume OTP/PIN and create member profile/sponsor/placement/consent/audit. Outcome is `PENDING_ACTIVATION`. It cannot claim financial eligibility.

Once enrolled, the same page reads `GET /members/me/tree?depth=4`, displaying only actual authenticated descendant nodes and their status; no synthetic genealogy.

## Admin route /member-operations

Authorized Admin/Super Admin/Auditor Compliance reads real package inventory, consent version history, and non-secret PIN audit records. Admin can create package/consent drafts and issue/revoke approved-package PINs; only independent SUPER_ADMIN may approve drafts, with an externally obtained review reference. Package and consent creation are feature-gated by `ADFLICK_MEMBER_CONFIG_ENABLED`, issuance by `ADFLICK_MEMBER_EPIN_ISSUANCE_ENABLED`; all privileged writes require an actual MFA step-up and JWT/RBAC.

PIN recipient lookup is **exact-email**, same-tenant, ACTIVE MEMBER, with no already-created profile. Only one-use 256-bit PIN appears in the issue response; MySQL stores only HMAC and lifecycle status. No secret appears in inventory. Staff must use an approved secure delivery process to hand off the PIN; this screen does not pretend SMS/SMTP transferred it to the member.

## Verified API contracts

- `GET /api/v1/member-enrollment/progress`: MEMBER, real status and gate data.
- `GET /api/v1/member-enrollment/eligible/:memberCode`: MEMBER, strict exact-code same-tenant ACTIVE rooted membership and available sides (snapshot).
- `POST /api/v1/member-enrollment/preflight`: MEMBER, same validated payload as pending enrollment; strict existing-user/PIN/OTP/consent checks, no writes.
- `GET /api/v1/member-enrollment/recipient?email=`: SUPER_ADMIN/ORGANIZATION_ADMIN, strict exact-email tenant lookup (403 unrelated roles, 404 absent/foreign).
- `GET /api/v1/member-enrollment/consents`: SUPER_ADMIN/ORGANIZATION_ADMIN/AUDITOR_COMPLIANCE, latest 100 consent versions/status/digests.
- Existing `POST /member-enrollment/enroll`: retains server-side atomic guarantee regardless of preflight/UI result.

## Acceptance and open blockers

Real MySQL HTTP acceptance tests assert 401/403/404, tenant boundaries, no personal details in member lookups, untouched PIN on preflight, duplicate/expired/revoked PIN rollback, existing OTP requirement and occupied-side concurrent conflict. Browser/shared-shell checks cover both routes on desktop/mobile. Independent screenshot/UI sign-off and operator local `npm run verify` follow GitHub CI PASS.

**Not complete:** approved mobile/SMS OTP gateway and identity policy, account phone capture, public full atomic Joining flow, sponsor transfer/spillover/reparenting policy, KYC/activation, financial earning/commission and production backups/recovery/provider UAT. Operator switches remain OFF. No demo/prototype records added to canonical application.
