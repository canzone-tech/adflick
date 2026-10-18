# BATCH 10 — Live Operations Dashboard, Alerts & Incident Management

## Delivered
- New MySQL/Prisma `Incident` entity with category, severity, lifecycle, optional screen, assignment, acknowledgement, resolution note and timestamps.
- `GET /api/v1/incidents/summary`: counts open, acknowledged, in-progress, critical and resolved-today incidents.
- `GET /api/v1/incidents`: organization-scoped incident list; optional `status` filter.
- `POST /api/v1/incidents`: create a manual incident and audit it.
- `PATCH /api/v1/incidents/:id`: assign, change severity/status and resolve with a required resolution note.
- `POST /api/v1/incidents/scan-alerts`: scan up to 500 screens in the active organization and create incidents for offline/stale screens, reported player errors and resource pressure >=95%.
- Alert generation avoids creating another incident for the same screen/category while one is OPEN, ACKNOWLEDGED or IN_PROGRESS.
- Responsive `/incidents` UI prototype with sample incidents, status filters, details and lifecycle actions.
- MySQL migration `202610140010_live_operations_incidents`.

## API authorization
All incident routes require JWT and role checks. List/summary: Super Admin, Organization Admin, Operations Manager, Support Agent, Auditor/Compliance and Finance Manager. Create/update/scan: Super Admin, Organization Admin, Operations Manager and Support Agent (scan restricted to Super Admin, Organization Admin and Operations Manager). Organization context is required; screen IDs and assignees are validated against that organization.

## Incident status lifecycle
- OPEN: new issue, waiting for triage.
- ACKNOWLEDGED: an operator has accepted ownership of the alert.
- IN_PROGRESS: investigation/recovery is underway.
- RESOLVED: resolution note required.
- DISMISSED: terminal status reserved for future explicit dismissal flow; current update DTO supports status updates subject to terminal-state guard.

Resolved and dismissed incidents are terminal. Create a follow-up incident for a recurrence rather than reopening a terminal record.

## Alert scan rules (initial defaults)
- Screen is OFFLINE, or is ONLINE with no heartbeat in the last 2 minutes: HIGH `SCREEN_OFFLINE`.
- A non-empty `lastPlayerError`: HIGH `PLAYER_ERROR`.
- Maximum reported CPU/memory/storage >=95%: HIGH `RESOURCE_PRESSURE`; >=99%: CRITICAL.
- A scan is operator-triggered. It is not a background job and does not deliver email/SMS/WhatsApp notifications.
- Telemetry is player-reported and may be spoofed. Alerts are operational signals, not attestation.

## Current limitations
- `/incidents` UI uses local sample data; it does not call the API.
- “Scan fleet alerts” in the prototype is informational only. Authorized API clients can call `POST /api/v1/incidents/scan-alerts`.
- No automatic scan cadence, notification channel, escalation timer, SLA policy, or incident comment/history timeline yet.
- The API lifecycle is not a full append-only event history; audit events capture create/update actions, but individual field-level change history needs more work.
- No build, Prisma validation or MySQL migration integration run has been performed in this environment.
