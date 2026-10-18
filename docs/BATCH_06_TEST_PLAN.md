# BATCH 06 acceptance test plan

## Campaign setup
- Creation without a valid organization context is rejected.
- Missing creative asset IDs is rejected.
- Assets that are not READY or belong to another organization are rejected.
- Duplicate creative IDs are rejected.
- Target screens from another organization or RETIRED screens are rejected.
- Duplicate screen targets are rejected.
- Currency must be a three-letter uppercase code.
- End time must be after start time.

## Tenant and role controls
- Advertiser lists only campaigns created by that advertiser in their organization.
- Advertiser cannot approve, reject, schedule, pause, resume or complete.
- Content Manager cannot review unless policy is explicitly changed.
- Support Agent and Screen Owner cannot manage campaigns.
- Finance Manager and Auditor / Compliance can list/read campaigns but cannot mutate them.
- Organization-scoped IDs from another tenant return not found/forbidden, without leaking record data.

## State transitions
- New campaign starts DRAFT.
- Only DRAFT/REJECTED can be edited or submitted.
- Submission requires at least one creative and moves to PENDING_REVIEW.
- Approve/reject only works for PENDING_REVIEW.
- Rejection requires a reason.
- Schedule only works for APPROVED campaigns and requires both dates.
- Campaign whose end time is in the past cannot be scheduled.
- Pause works only for ACTIVE/SCHEDULED.
- Resume works only for PAUSED.
- Complete works only for ACTIVE/PAUSED/SCHEDULED.
- Every invalid transition returns a clear 4xx response.

## Database / build
- `npx prisma validate`
- `npm run db:generate`
- Apply migration against MySQL 8.4 in a disposable test database.
- `npm run build:api`, `npm run build:web`, typecheck and lint.
- API integration tests for tenant boundaries and simultaneous review actions.
- Confirm migrations are safe on a backup copy of any existing database.
