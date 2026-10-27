# SRS v1.0 — Member genealogy foundation (27 October 2026)

**Functional SRS scope:** approved by project owner. **This phase:** additive, real MySQL schema + authenticated, tenant-scoped, read-only NestJS endpoints for MemberProfile, SponsorRelationship, PlacementNode and BinaryTreeRoot. No sample records in application. No e-PIN, money, live enrollment or production activation.

## Database contract

- `UserRole.MEMBER` extends existing JWT/RBAC. A MemberProfile belongs to exactly one existing User and Organization. A composite `(userId, organizationId)` FK prevents cross-tenant account binding.
- Member codes are unique **within an organization**. Member-code format and issuance algorithm remain an open owner decision; do not infer a public ID format from these test fixtures.
- SponsorRelationship and PlacementNode are **two separate tables**. Both relationships use `(organizationId, memberId)` compound FKs, preventing direct cross-tenant association.
- BinaryTreeRoot: one root per organization. PlacementNode: one non-root placement per member, unique `(parentMemberId,side)`. Both use MySQL constraints to reject duplicate LEFT/RIGHT slots under concurrency; MySQL 8.4 does not permit direct CHECK guards on FK cascade columns; prevention of self-link and multi-node cycles belongs to the guarded write service. No mutation endpoint existed in this earlier milestone.
- Genealogy in read APIs is limited to four levels, with member-owned reads rooted in the authenticated account only. This is a conservative privacy boundary and not a claim about the future product tree-depth policy.
- Pending activation is the default; no service in this delivery sets ACTIVE and no integration posts compensation. The subsequent enrollment milestone adds a feature-gated **pending-only** authenticated-user transaction; public registration, OTP and member activation remain disabled without separate policy sign-off. See [Enrollment](SRS-V1-ENROLLMENT.md).
- Multi-node cycle prevention, root-versus-placement exclusivity and sponsor-versus-placement spillover require the upcoming **atomic registration service** with transaction locks and service-side validation; the schema alone does **not** certify those rules. Direct DB writes outside application services are not authorized.

## REST (existing JWT session + RBAC)

- `GET /api/v1/members?take=25&skip=0`: SUPER_ADMIN / ORGANIZATION_ADMIN / AUDITOR_COMPLIANCE, mandatory tenant, bounded read. No mobile/email, secrets or PIN data.
- `GET /api/v1/members/:memberCode`: same staff roles, organization lookup, generic cross-tenant 404.
- `GET /api/v1/members/:memberCode/tree?depth=3`: same staff roles; read-only bounded placement descendants; sponsor is shown separately in details.
- `GET /api/v1/members/me` and `GET /api/v1/members/me/tree?depth=3`: MEMBER role; no arbitrary member IDs or other branches accepted. No direct account login/pin issuance added.

## Evidence and UAT limitations

`apps/api/test/members.mysql.e2e-spec.ts` uses only isolated disposable MySQL with temporary `@example.test` fixtures, creating real tenant records solely within that database. Tests assert HTTP 401/403/404, tenant scoping, no PII, bounded depth/pagination, sponsor-versus-placement separation, actual MySQL duplicate-slot concurrent conflict, compound FK isolation and explicit absence of enrollment/placement mutations. `npm run verify` wires this to the backend MySQL gate.

**AT-01–05 remain PENDING overall.** The database integrity slice of AT-05 is tested; public account registration, OTP, commercial e-PIN lifecycle approval, full cycle/correction rules and member UI are not complete. Neither exact-SHA CI nor local verification proves commercial or production acceptance.

## Next implementation gate

Owner approves member ID strategy, registration identity/OTP/consent and e-PIN lifecycle, then build audited `packages` + `epins` models and an atomic transaction: validate/consume PIN exactly once, create user+profile, assign sponsor and placement, enforce no cycles/spillover, issue immutable activation, send approved communications via outbox. **Never permit enrollment bypassing PIN, and never post binary commissions until signed plan/legal/provider approval.**
