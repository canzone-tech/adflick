# BATCH 08 — Campaign Scheduler, Playlist Assignment & Player Sync

## Scope
Cumulative source BATCH 01–08. This batch introduces a simple in-process scheduler, screen-to-playlist assignment endpoints, refresh commands, and assigned playlist entries in player manifests.

## Campaign scheduler
- Scheduler starts with the API process unless `SCHEDULER_ENABLED=false`.
- Cycle interval uses `SCHEDULER_INTERVAL_MS`, default 60 seconds and clamped to a minimum of 30 seconds.
- Scheduled campaigns whose start time has arrived and whose end time is in the future move to ACTIVE.
- Scheduled campaigns whose end time has passed, plus ACTIVE/PAUSED campaigns whose end time has passed, move to COMPLETED.
- Scheduled campaigns with a start in the past and no end date move to ACTIVE.
- Scheduler emits REFRESH_PLAYLIST commands for enabled assignments when no recent refresh command was created in the last five minutes.

## Playlist assignment API
All routes use JWT auth and organization context:
- `GET /api/v1/fleet/screens/:id/playlists`
- `POST /api/v1/fleet/screens/:id/playlists`
- `PATCH /api/v1/fleet/screens/:id/playlists/:assignmentId/disable`

Write roles: Super Admin, Organization Admin, Operations Manager, Content Manager.
Read roles: those roles plus Auditor / Compliance and Support Agent.
Assignment requires an ACTIVE playlist and an eligible screen in the same organization. Start must precede end. Reassigning the same screen/playlist updates the existing assignment. Assignment changes enqueue a refresh command.

Request example:
```json
{
  "playlistId": "playlist_id",
  "priority": 20,
  "startsAt": "2026-10-14T09:00:00.000Z",
  "endsAt": "2026-10-31T18:00:00.000Z"
}
```

## Manifest updates
The device manifest now includes campaign creative entries plus assets from active playlists assigned to that screen within the assignment window. Playlist entries are ordered by assignment priority, assignment creation time, and item order. Each entry has a short-lived signed media URL and a server-issued playback authorization tied to the screen, asset, and playlist.

## Operational caveats
- This scheduler runs in-process. Until a distributed lease/lock and leader-election strategy is added, run only one API replica with the scheduler enabled. Multiple replicas can race to transition campaigns or enqueue commands.
- The worker polls every cycle; it is not a durable job queue and has no retry/backoff dashboard.
- Schedule timestamps are stored as DateTime values. The current worker does not perform per-screen timezone/daypart expansion.
- Playlist `itemsJson` is treated as an array of `{ assetId, durationMs? }`; malformed items are skipped.
- Playlist entries and campaign creative entries may both appear in a manifest, which can cause duplicate delivery unless the operator manages campaign/playlist composition.
- The dashboard is a local sample-data prototype and is not connected to the API.
- No advertiser billing or screen-owner payout is performed by this batch.
