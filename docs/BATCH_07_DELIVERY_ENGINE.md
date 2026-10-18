# BATCH 07 — Campaign Delivery Engine and Scheduled Playback Foundation

## Delivered
- Device-authenticated manifest route: `GET /api/v1/devices/:id/manifest`.
- Manifest resolver filters to the device organization, `ACTIVE` campaigns, current campaign dates, and explicit target screens (campaigns with no explicit targets are organization-wide).
- Creative assets must be `READY` and have a storage key.
- Media is returned through short-lived S3-compatible signed download URLs.
- Per-manifest `PlaybackAuthorization` records bind organization, screen, asset and campaign. Raw token is random and returned only to the device; only its SHA-256 hash is stored.
- Playback events now require a server-issued authorization ID/token. Authorization must match screen, organization, asset and campaign, remain unexpired, and not already be consumed.
- Terminal events consume authorization. Duplicate event IDs remain idempotently rejected by the existing unique key.
- A bounded cleanup of expired/old consumed authorization records runs during manifest fetch.
- Added responsive `/delivery` dashboard preview and player protocol document.

## Endpoint
`GET /api/v1/devices/:id/manifest`
- Auth: paired device secret in `x-device-secret`
- Rate limited: 30 requests per minute
- Manifest expiry: 5 minutes
- Suggested refresh: 60 seconds
- Authorization expiry: up to 20 minutes, capped by manifest expiry
- Media signed URL expiry is controlled by existing storage service (5 minutes)

## Delivery eligibility
Only campaigns whose database status is `ACTIVE` are delivered. `startsAt` must be null or in the past; `endsAt` must be null or in the future. Campaigns with explicit screen targets only reach those screens; campaigns without targets are organization-wide. This batch does not introduce geographic targeting, daypart schedules, frequency caps, budget pacing, or automatic status transitions.

## Security boundaries
- Device secrets are checked with constant-time hash comparison.
- Authorization token hashes are stored, not raw tokens.
- Manifest and media URLs are short-lived.
- A terminal event consumes an authorization to make replay harder.
- Client telemetry is still not trusted proof of actual display. Device-root compromise, local event fabrication, screenshot verification, hardware attestation, secure monotonic counters, manifest signatures and anomaly detection need further work.
- Playback authorizations are not payment approvals. No billing or payout is executed by this batch.

## Important limitations
- Manifest currently emits campaign creatives as ordered entries; there is no adaptive playlist selection or layout-zone rendering in this batch.
- The `/delivery` dashboard is sample-data only and is not wired to live APIs.
- Campaigns must be moved to `ACTIVE` through the existing workflow; a background scheduler for start/end transitions is not included.
- Validate schema and migrations, then run integration tests against MySQL 8.4 and a configured S3-compatible store before deployment.
