# ADFLICK — Client SRS v1.0 requirement-to-code assessment

**Assessment date:** 2026-10-27
**Client source:** `ADFLICK_Binary_1x1_MLM_Complete_SRS.docx`, dated 23 October 2026; originally marked **v1.0 DRAFT for stakeholder review**. **Functional development scope APPROVED by project owner in chat on 27 October 2026**. Commercial/legal/payment rules are NOT approved.
**Audited code:** `dev/local-foundation` at `95b36c271bddb3405799e47726eed83a408ce10b`.
**Decision:** **EXTEND, DO NOT RESTART** the existing Adflick monorepo. Its NestJS/Next.js/MySQL/Prisma/auth/CI foundation is useful, but a Binary 1:1 MLM product is **not implemented or releasable** merely because the playout CI is green.
**Evidence convention:** PRESENT=identified live canonical code (not acceptance); PARTIAL=some foundational pieces; MISSING=no corresponding live canonical Prisma/API module; BLOCKED=approval, provider, device or operator evidence missing. All acceptance criteria require test evidence before PASS.

## Section-by-section SRS reconciliation

| Client SRS (page/section) | Status | Current repository evidence | Required delta |
| --- | --- | --- | --- |
| §2, §17 technology baseline (pp.3,15) | PRESENT | `apps/web` Next.js, `apps/api` NestJS, `prisma/schema.prisma` MySQL, root npm workspaces, separate CI and `npm run verify` | Keep stack; add missing domain modules, avoid rewrite |
| §3 distinct roles and navigation (pp.4–5) | PARTIAL | `prisma/schema.prisma` `UserRole` has SUPER_ADMIN/ORGANIZATION_ADMIN/FINANCE_MANAGER/SUPPORT_AGENT/ADVERTISER/SCREEN_OWNER; JWT/RBAC and MFA present; no MEMBER role; `apps/web/app/page.tsx` is an operator CMS dashboard | Add approved member identity/role, route/data boundaries, separate role-specific menus, deny-by-default tests |
| §5 public marketing/CMS (pp.6–7) | PARTIAL | `apps/api/src/cms` is **screen media/layout/playlist** CMS, not full public-page/banner/legal CMS. `apps/web/app/page.tsx` shows playout operator dashboard instead of public marketing | Public pages, page CMS, image-only 10-slide hero, legal disclosures, consent, mobile/keyboard accessibility |
| §5.3 registration and consent (pp.7–8) | MISSING | `auth.controller.ts` supports operational login, refresh, logout and MFA; no live member registration + e-PIN redemption + sponsor + placement atomic workflow in `AppModule` or Prisma | Server-validated registration, OTP, sponsor lookup, slot check, consent records, atomic transaction, concurrency tests |
| §6 member portal/referrals (pp.8–9) | MISSING | `apps/web/app/account/page.tsx` is provisioned organization account/security profile, not member dashboard; no live member/referral module | Member ID/profile/contacts; authorized referral, device, wallet, statement and support views |
| §6.3 & §7 binary genealogy/pairing (pp.8–9) | MISSING | `prisma/schema.prisma` has no `SponsorRelationship`, `PlacementNode`, `VolumeEvent`, `PairingRun`/allocation; `apps/api/src/app.module.ts` no MLM module | Distinct immutable sponsor vs placement; unique parent-side; no cycles; matching volume ledger, dry-run, deterministic cap/carry/rollback and versioned snapshots |
| §8 packages and e-PIN (pp.9–10) | MISSING | Canonical schema has no `Package`, `Activation`, `EPin`, `EPinEvent` models or corresponding runtime controllers | Token hashes, inventory, owner/transfer/expiry/revoke lifecycle, audit, atomic one-time redeem |
| §9 commissions, wallet, payout (p.10) | PARTIAL / BIG GAP | `finance` and `payouts` modules implement **device screen-owner reward ledger/batches**, not member binary/referral commission ledger and withdrawal wallet; `RewardLedgerEntry` FK points to `RewardCalculation` | Separate member commission sources/plan version, ledger/wallet balances, payout requests, reversal and provider UAT; do not conflate device rewards with MLM earnings |
| §10 Admin/Super Admin (p.11) | PARTIAL | Operational RBAC controllers and Finance/CMS/Device UIs exist; member/e-PIN/genealogy/plan-version workflows absent | Permission-scoped admins and finance, independent approval, business rules simulator, member administration |
| §11 advertising/screens (pp.11–12) | PARTIAL | `campaigns`, `devices`, `playback`, `scheduler`, `delivery`, `cms` canonical API and related schema exist; playback event has unique `[screenId,eventId]`; source-backed validation uses device secret/server-issued authorization | Real player attestation/device testing, verified target eligibility and fraud criteria, live campaign UI/storage integrations and approved ads/business rules |
| §12 reports, notifications, support (p.12) | PARTIAL | `NotificationOutbox` and report/domain helpers exist; no canonical `SupportTicket` model; recovered reporting policies are not wired | Support ticket lifecycle/SLA, SRS exports, bounded role-scoped reports, delivery adapters and consent |
| §13 data models and transactions (pp.12–13) | PARTIAL | MySQL schema has `User`, `Screen`, `Campaign`, `PlaybackEvent`, `RewardPolicy`, `RewardLedgerEntry`, `PayoutBatch`, `AuditEvent`; lacks core member, sponsor, placement, package, PIN, pairing, consent, support models | Append-only reviewed migrations, transaction and unique constraints, source-event idempotency and member domain audit |
| §14 REST/API/OpenAPI (pp.13–14) | PARTIAL | `apps/api/src/main.ts` sets `/api/v1`, global DTO validation; existing auth/campaign/device/finance routes; no sponsor/ePIN/member/pairing endpoints | SRS APIs, OpenAPI contract, object-scope auth, request keys, error-code contract and tests |
| §15 security/privacy/compliance (pp.14–15) | PARTIAL / APPROVAL BLOCKED | Argon2, JWT rotation, MFA, RBAC, CSRF origin boundary and HTTP security test fixtures exist; real privacy/legal/security sign-off absent | Threat model for new MLM endpoints, OTP/PIN throttles, redaction, retention/consent, qualified Indian legal/tax/finance review |
| §16–19 NFR/UAT/deploy (pp.15–17) | BLOCKED FOR PRODUCT RELEASE | Three exact-SHA CI gates and local acceptance mechanics present; CI is for the *current playout code*, not SRS AT-01…20 | End-to-end role/binary/e-PIN/payment/device/accessibility/load UAT, real restore/rollback, approved releases |

## Client acceptance scenarios — evidence required

**No AT-01…AT-20 may be described as product-accepted without independently checked end-to-end evidence on an exact SHA.**

| SRS AT | What must be demonstrated | Current assessment |
| --- | --- | --- |
| AT-01 | One-use e-PIN + member activation atomic | MISSING |
| AT-02 | Expired/revoked/wrong package/reused PIN rejected | MISSING |
| AT-03 | Privacy-safe sponsor lookup, enumeration resistance | MISSING |
| AT-04 | Occupied placement slot rejects without partial registration | MISSING |
| AT-05 | Concurrent same-side placement impossible | MISSING |
| AT-06 | Member/admin unauthorized APIs denied | PARTIAL: operational RBAC tests; member model absent |
| AT-07 | Each actual SRS role gets permitted navigation/data | MISSING: SRS role matrix not implemented |
| AT-08 | Duplicate volume source can't create duplicate pairs/commission | MISSING |
| AT-09 | Reproducible pairing run, caps, carry-forward, version | MISSING |
| AT-10 | Approved refund/chargeback reversal preserves original entry | MISSING in member commission domain |
| AT-11 | Member payout cannot exceed available wallet or pay twice | PARTIAL: screen-owner payout controls are a different financial domain |
| AT-12 | e-PIN transfer/revoke inventory + audit | MISSING |
| AT-13 | Screen reward requires targets/campaign/device/fraud gates | PARTIAL: policy/backend exists; physical evidence/policy approval pending |
| AT-14 | Reject duplicate/unsigned/invalid playback | PARTIAL: source tests/validation; real device evidence pending |
| AT-15 | Plan change simulation/approval and immutable historical rules | MISSING for MLM plan version |
| AT-16 | Authorized logged export with minimized sensitive data | PARTIAL: policy helpers; integration evidence required |
| AT-17 | Responsive public homepage at 320px | MISSING: current root is operator dashboard |
| AT-18 | Hero controls, keyboard/reduced-motion | MISSING |
| AT-19 | Versioned consent/timestamp on registration | MISSING |
| AT-20 | Isolated backup restore against agreed RPO/RTO | BLOCKED: production evidence pending |

## Important technical risks

1. **Core product mismatch:** current UI routes and canonical database model playout operations, not the SRS member MLM experience. Treat this as significant additive scope, not a CSS refactor.
2. **Financial domain boundary:** existing `RewardLedgerEntry` is tied to screen-owner `RewardCalculation`; it is not sufficient as-is for direct referral, binary match, level/pool, or member payout. Design independently auditable sources and deterministic allocation with MySQL as authority.
3. **SRS is DRAFT:** package artwork figures, ₹5,000 pair example, advertised daily returns, 30% direct / 20% binary / seven-level percentages, reward pools and TV/mobile rental figures are unapproved. **Never hardcode or activate** these as client-approved earnings.
4. **Existing risk to review before product launch:** the canonical `RewardPolicy` has pre-populated illustrative paise defaults, `enabled=false` by default, and `finance.controller.ts` exposes an `upsertPolicy` endpoint whose DTO accepts `enabled`. That is *not* evidence of legal/business approval; production financial activation needs a separate deny-default signed-policy gate. Do not silently rewrite already approved application behavior.
5. **Historical migration integrity:** never rewrite applied MySQL migrations or destructively replace real data. Introduce new models with reviewed additive migration sequence and idempotency/constraint tests.
6. **No unsupported PASS:** current Backend/Frontend/Release Evidence green only verifies their defined checks. They do not prove member/MLM client scenarios or commercial/production acceptance.
7. **Identity separation:** `ORGANIZATION_ADMIN` is an Adflick operations role, not a substitute for SRS `Member`; avoid accidental privilege escalation, cross-member data leaks or sponsor/genealogy scope confusion.

## Explicit decision requests before coding real compensation

- **CONFIRMED 2026-10-27:** product owner approved SRS v1.0 functional development scope in chat; no signed commercial/legal policy implied.
- Finance/business defines exact pair unit, qualification, caps, timezone, carry-forward, flushed volume, commission rates/bases, stacking, reversals and thresholds.
- Product/legal approves registration/KYC/OTP, package sales/e-PIN, tax/refund terms, consumer disclosures, marketing claims, consent and privacy.
- Independent legal/tax/finance/compliance review for paid joining, referral/binary commissions, prizes/pools/device rewards (client SRS §4.1, §15.3).
- No need to wait for commercial values to implement **disabled**, policy-neutral member/placement/e-PIN/consent foundations once their workflow and data contract are approved.

## Execution gate

GitHub feature unit -> exact SHA Backend CI, Frontend CI and Release Evidence all green -> user `git pull` + root `npm run verify` -> separate owner UAT -> separate production approval and real restore proof. This document is analysis, not business acceptance.


## Incremental implementation evidence — member genealogy foundation

The new read-only P1 member genealogy slice (Prisma models, migration, JWT/RBAC routes and MySQL E2E) is documented in [SRS v1.0 Member Genealogy Foundation](SRS-V1-MEMBER-GENEALOGY.md). Scope: same-tenant FK, one LEFT/RIGHT slot with MySQL uniqueness, member-owned descendant read, no e-PIN activation or commissions. **AT-01–AT-05 remain incomplete** until real atomic registration and cycle/consent/PIN tests pass; no production signoff.

## Enrollment slice — evidence boundary

Read-only e-PIN listings, draft non-financial packages, versioned consent, maker-checker approval, recipient-bound HMAC e-PIN issuance/revocation and authenticated **pending** enrollment are implemented behind default-deny runtime flags. Existing-user only (no public account creation/OTP), SRS AT-01..05 **not fully accepted**. [Detailed contract](SRS-V1-ENROLLMENT.md).
