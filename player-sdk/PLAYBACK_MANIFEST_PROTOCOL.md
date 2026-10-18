# Player Manifest and Playback Authorization Protocol — BATCH 07

## Fetch manifest
`GET /api/v1/devices/{screenId}/manifest`

Header: `x-device-secret: <paired-device-secret>`

The API returns a versioned manifest with an expiry time and eligible campaign creatives. Each entry includes a short-lived signed object-storage URL plus:
- `authorization.id`
- `authorization.token`
- `authorization.expiresAt`

The raw authorization token is shown only to the paired player in the response. The database stores only its SHA-256 hash. Treat tokens and media URLs as secrets; do not put them in logs or analytics.

## Player behavior
1. Fetch a manifest after startup and when the current manifest approaches expiry.
2. Verify `schemaVersion` and `expiresAt`. Do not start new content from an expired manifest.
3. Download/cache media according to device storage policy. Do not persist signed media URLs beyond their expiry.
4. Emit `PLAY_STARTED` with `authorizationId` and `authorizationToken`.
5. Emit one terminal event (`PLAY_COMPLETED`, `PLAY_INTERRUPTED`, or `PLAY_ERROR`) using the same authorization pair.
6. A terminal event consumes that authorization. A new attempt requires a fresh manifest entry/token.
7. Batch events must preserve each event's authorization fields. Event IDs remain unique per screen.
8. Never interpret a local player event as cryptographic proof that pixels were physically displayed. Device attestation, tamper resistance, anomaly detection and server-side reconciliation are separate controls.

## Event example
```json
{
  "eventId": "player-install-uuid:sequence-184",
  "eventType": "PLAY_COMPLETED",
  "assetId": "asset_id_from_manifest",
  "campaignId": "campaign_id_from_manifest",
  "authorizationId": "authorization_id_from_manifest",
  "authorizationToken": "raw_token_from_manifest",
  "startedAt": "2026-10-14T10:00:00.000Z",
  "completedAt": "2026-10-14T10:00:15.000Z",
  "durationMs": 15000,
  "expectedDurationMs": 15000
}
```

All timestamps should be ISO 8601. Device clocks must be synchronized; server validation remains authoritative for accepted time windows. Tokens are short-lived and single-use for terminal events. Do not reuse a token after a terminal result.


## BATCH 08 playlist assignments
Manifest entries sourced from an assigned playlist include `source: PLAYLIST`, `playlistId`, `playlistName`, `playlistPriority`, and `playlistOrder`. Playback events for these entries must include the exact `playlistId` plus the authorization ID/token. Playlist `itemsJson` is currently interpreted as an array of objects containing `assetId` and optional `durationMs`.
