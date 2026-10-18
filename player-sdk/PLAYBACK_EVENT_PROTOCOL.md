# Player Playback Event Protocol

Submit events to `POST /api/v1/devices/{screenId}/playback/events` using the `x-device-secret` header over TLS.

Example:
```json
{
  "events": [
    {
      "eventId": "random-unique-per-screen-event-id",
      "eventType": "PLAY_COMPLETED",
      "assetId": "database-asset-id",
      "campaignId": "optional-campaign-id",
      "playlistId": "optional-active-playlist-id",
      "startedAt": "2026-10-14T10:30:00.000Z",
      "completedAt": "2026-10-14T10:30:15.000Z",
      "clientReportedAt": "2026-10-14T10:30:15.100Z",
      "durationMs": 15000,
      "expectedDurationMs": 15000,
      "sequenceNumber": "1042",
      "metadata": { "playerMode": "foreground" }
    }
  ]
}
```

Requirements:
- Generate unique event IDs using a cryptographically secure random source.
- Persist events locally while offline and retry with exponential backoff.
- Do not change event ID on retry.
- Send small batches and cap each batch at 100 events.
- Keep the device secret in platform secure storage; never include it in logs.
- Report actual playback state, not scheduled playback.
- Use a monotonic clock for local elapsed duration; wall-clock timestamps are still required for server reconciliation.
- A successful API response only means the event was processed by the API. Handle rejected and duplicate outcomes.
- Never treat an event as payable merely because the client reports it. The server's future eligibility policy must include additional anti-fraud checks.
