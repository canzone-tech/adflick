# BATCH 06 — Campaign Management and Approval Workflow

## Scope
Cumulative BATCH 01–06. Adds campaign creative association, screen targeting, advertiser draft creation, review decisions and manual scheduling/lifecycle endpoints.

## Data model
`Campaign` gains description, creator ID, submission/review timestamps, reviewer ID and review note.
`CampaignCreative` associates a campaign with READY media assets and stores a stable sort order.
`CampaignScreenTarget` associates campaigns with screens. A campaign with no explicit screen targets is treated as broadly targeted by this data model; the delivery resolver must still apply organization, device, format, campaign date and policy checks.

## API routes
All routes require authenticated JWT and role checks:
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/:id`
- `POST /api/v1/campaigns`
- `PATCH /api/v1/campaigns/:id`
- `POST /api/v1/campaigns/:id/submit`
- `POST /api/v1/campaigns/:id/approve`
- `POST /api/v1/campaigns/:id/reject`
- `POST /api/v1/campaigns/:id/schedule`
- `POST /api/v1/campaigns/:id/pause`
- `POST /api/v1/campaigns/:id/resume`
- `POST /api/v1/campaigns/:id/complete`

## Workflow rules
- New campaigns start in DRAFT.
- Creatives must be READY assets belonging to the same organization.
- Optional screen targets must exist in the same organization and cannot be RETIRED.
- End must be later than start.
- DRAFT or REJECTED campaigns can be edited and submitted.
- Submission moves the campaign to PENDING_REVIEW.
- Only Super Admin, Organization Admin or Operations Manager can approve/reject.
- Rejection requires a reason; the campaign must be submitted before review.
- Only APPROVED campaigns can be scheduled, and both start/end times must be set.
- Scheduling selects ACTIVE when the start time has arrived, otherwise SCHEDULED.
- Pause/resume/complete transitions are limited to Operations Manager, Organization Admin and Super Admin.
- Advertisers see their own campaigns; authorized organization roles can view organization campaigns.
- Campaign budget is stored in paise, with currency as a three-letter uppercase code.

## Security and financial boundaries
- Tenant isolation is enforced in service queries for organization-bound campaigns, creative assets and target screens.
- This batch does not reserve funds, charge advertisers, generate invoices, create owner earnings, or trigger payouts.
- No background scheduler activates SCHEDULED campaigns or completes expired campaigns yet.
- No player delivery manifest is generated in this batch.
- Finance and billing must not assume budget equals spend; actual billing must be derived from trusted, accepted playback and the pricing contract.

## UI
`/campaigns` includes a responsive sample campaign list, filters, a local draft-creation form, and preview-only workflow buttons. It does not call the API. Live UI integration and authorization-aware error states remain pending.
