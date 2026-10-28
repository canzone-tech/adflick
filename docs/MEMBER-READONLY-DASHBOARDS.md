# ADFLICK — Five read-only member reporting milestones

**Implementation:** SRS v1.0 §6, §7, §10 incremental UI and report visibility only, not a payout, pairing, commercial enrollment, KYC or production release approval. GitHub: `dev/local-foundation`.

1. **Owned Member Dashboard:** `GET /api/v1/members/me/dashboard` (JWT MEMBER) returns current organization's actual member code/status, sponsor separately from placement parent, two direct placement occupants and direct sponsor count. An email-verified user without a member profile gets `hasProfile:false`, never fabricated sample data.
2. **Direct referrals:** `GET /api/v1/members/me/referrals?take=1..100&skip=0..10000` (JWT MEMBER) returns only currently recorded direct sponsor relationships (member code, pending/active/suspended status, timestamp), bounded pagination, total. Never discloses referral email, phone, name, address, payout or PIN.
3. **LEFT/RIGHT visible team:** `GET /api/v1/members/me/team-summary?depth=1..4` (JWT MEMBER), resolves real placement nodes via the existing cycle-checking depth-limited tree traversal. LEFT/RIGHT determined by first direct edge, each member counted exactly once within selected levels. Counts are **VISIBLE DEPTH**, not lifetime/full genealogy totals, sales volume or pairable commissions.
4. **Admin operational snapshot:** `GET /api/v1/members/overview` (JWT SUPER_ADMIN / ORGANIZATION_ADMIN / AUDITOR_COMPLIANCE), MySQL grouped tenant-local status counts, LEFT/RIGHT placement, e-PIN lifecycle, approved consent and enabled package. Read-only, no funds, no cross-tenant directory.
5. **Full-stack QA and consistent design:** New `/member-dashboard` uses shared AppChrome and mobile 320/390/768/1280 shell checks, real loading/errors, no-profile state, referral Next/Previous and depth selector. Existing `/member-operations` displays server-only counters. Disposable MySQL HTTP suite checks missing roles, cross-tenant 404/empty, pagination limits, empty account, 1–4 depth and honest totals after concurrent placement collision. No fixtures in application runtime.

**Pending approvals/limitations:** Current member-contact update, live SMS provider and handset tests, full Sponsor/Placement business decisions, member activation, real financial ledger/wallet, dry-run pairing policies, sensitive PII retention, real role-based browser visual UAT, VPS backup/restore, explicit production release sign-off. No changes to production or existing payout/commission rules.

## Follow-up member UX security and retry hardening (2026-10-28)

- Member Dashboard and Onboarding first fetch `/auth/me` and require MEMBER before any MEMBER-only API call. Other authenticated staff see a role-specific message, not a confusing 403 from an unnecessary member API request. Their data is never rendered on member pages.
- Operations first checks authorized staff role before loading organization records and offers a login link for guests. All three pages have accessible explicit retry actions after request failures; reloading clears stale records and one-time PIN display on the staff page rather than showing cross-session data.
- The real MySQL member HTTP suite repeats authenticated dashboard/referrals requests, compares persisted results, and confirms foreign-tenant absence and staff denial. This is HTTP reload persistence evidence, not application process-restart or production database recovery proof.
- Browser Chrome UAT checks anonymous member/staff content remains hidden, tests authenticated ORGANIZATION_ADMIN role messages without member data, and keeps existing 320/390/768/1280 viewport checks. Production visual approval remains separate.

## Subsequent five-slice member enrollment safety and PIN inventory (2026-10-28)

- Member Onboarding ignores sponsor/parent lookup replies belonging to edited codes; an in-flight preflight no longer reappears after the user changes sponsor, parent, side, PIN or consent. These are client display safeguards; the server still makes every authorization and atomic placement decision.
- Authorized e-PIN recipient search discards results for email text edited while lookup was in flight, and clears prior recipient/one-time secret display on edit or reload. Real tenant checks remain server-side.
- Staff e-PIN expiry validates a real future timestamp within the existing server's 366-day technical guard before POST. Server validation is unchanged, and no payments or PIN transfer are enabled.
- The previous 100-row truncation now has bounded 25-record Next/Previous inventory navigation. Pagination uses the existing real MySQL total/skip/take API; no token hash or bearer PIN is listed. Issuance, approval and revocation stay subject to current RBAC/MFA and feature flags.
- A completed mutation followed by a failed list refresh is reported as accepted-with-reload-error rather than misreported as a failed issuance. Do not repeat a PIN issuance without checking the inventory. Browser route smoke covers 320/360/390/412/768/1280px and public Join; MySQL acceptance covers invalid issuance expiry, pagination and protected inventory.

The above is development/QA scope only. No business payout, compensation, automatic activation, marketing/legal sign-off, SMS provider certification or production deployment is implied.
