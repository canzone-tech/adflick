# BATCH 10 acceptance test plan

## Schema and migration
- Run `npx prisma validate` and `npm run db:generate`.
- Apply migration against disposable MySQL 8.4.
- Confirm Incident organization FK cascades and screen FK becomes null if a screen is deleted.
- Verify enum values and all three incident indexes.

## Organization and role isolation
- Requests without JWT return 401.
- Roles outside read allowlist cannot list/summary incidents.
- Roles outside write allowlist cannot create/update incidents.
- Missing organization context is rejected.
- Cross-organization screen IDs are rejected on create.
- Cross-organization assignees are rejected.
- An incident from another organization cannot be updated or discovered by ID.

## Incident lifecycle
- Create trims title and description and applies defaults.
- Acknowledge sets acknowledgedAt only once.
- Resolve without an existing or supplied resolution note is rejected.
- Resolve with a resolution note sets resolvedAt.
- Resolved/dismissed incident cannot transition to another status.
- Audit event created for manual create and updates.
- List status filter accepts only supported enum values; invalid values return a client error.

## Alert scan
- OFFLINE/stale ONLINE screens create SCREEN_OFFLINE incident.
- Reported player error creates PLAYER_ERROR incident.
- Any resource value >=95 creates RESOURCE_PRESSURE; >=99 is critical.
- An active incident of the same category/screen prevents a duplicate.
- A resolved incident does not prevent a new incident for a recurrence.
- Scan is scoped to current organization and only scans up to 500 screens.
- Repeated scans do not create duplicates while incident is active.

## UI and integration
- `/incidents` filters, selection and lifecycle actions work at mobile and desktop widths.
- Confirm the prototype clearly says its data and actions are local-only.
- API integration tests should assert response DTO shape and status codes.
- Do not claim email/SMS alerts are delivered until a real provider is connected and tested.
