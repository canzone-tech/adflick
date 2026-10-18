# BATCH 05 — Playback Engine and Proof of Play

## Scope
This batch adds a device-authenticated event ingestion API, a persistent playback event ledger, initial validation rules and a reporting endpoint. It does not claim tamper-proof playback; events originate from a device that possesses a device secret and require additional trust controls before use for billing or owner payouts.

## Database
`PlaybackEvent` stores:
- organization, screen, media asset and optional campaign/playlist references
- client event ID unique per screen for idempotency
- event type: PLAY_STARTED, PLAY_COMPLETED, PLAY_INTERRUPTED, PLAY_ERROR
- validation status and reason
- started/completed/client-reported/received timestamps
- reported and expected duration
- optional sequence number and metadata
- indexes for organization reports, screen events, campaigns and assets

## Device endpoint
`POST /api/v1/devices/:id/playback/events`
- Authenticates with `x-device-secret`.
- Accepts 1–100 events per request.
- Uses `screenId + eventId` uniqueness to prevent duplicate records.
- Checks asset organization and READY status.
- When supplied, checks campaign organization, approval status and campaign dates.
- When supplied, checks that the asset belongs to an active playlist in the same organization.
- Requires timestamps and duration for PLAY_COMPLETED.
- Applies a baseline 90% expected-duration threshold and duration/timestamp consistency check.
- Rejects very old or implausibly future completion events.
- Returns per-event accepted/rejected/duplicate results.

## Reporting endpoint
`GET /api/v1/reports/playback?screenId=<optional>`
- Requires a user JWT.
- Restricted to Super Admin, Organization Admin, Operations Manager, Finance Manager and Auditor / Compliance.
- Reports accepted PLAY_COMPLETED records in the user's organization, with per-screen counts.

## Important interpretation
`ACCEPTED` means the event passed the current API's validation rules. It is not cryptographic proof that the physical display showed the entire ad to a real viewer. The client may be compromised, clocks can be manipulated, and event claims can be fabricated by a device that has credentials.

Do not calculate payable rentals or advertiser invoices from this event ledger alone yet. Before financial use, implement:
- signed playback manifests / server-issued play sessions with short-lived nonces
- server-side asset-to-campaign authorization at playback time
- monotonically increasing sequence numbers and anti-replay policy
- trusted player telemetry and capability checks
- server-side log correlation, anomaly scoring and review workflows
- idempotent aggregation tables and immutable audit retention
- device credential rotation, revocation and compromise response

## Validation baseline
- `PLAY_STARTED` requires `startedAt`.
- `PLAY_COMPLETED` requires `startedAt`, `completedAt`, and `durationMs`.
- `completedAt` must be at or after `startedAt`.
- Event timestamps must fall within the configured acceptance window.
- Expected duration must come from server-known media duration or the active playlist item; client-reported expected duration must match it. Completion must reach 90%.
- `completedAt - startedAt` should match the reported duration within a tolerance.
- The asset must be READY and belong to the device's organization.
- If campaign/playlist IDs are supplied, they must belong to the organization and satisfy current state checks.

## UI
`/playback` is a responsive demonstration ledger with filters and CSV export. It uses local sample data; live API integration remains future work.
