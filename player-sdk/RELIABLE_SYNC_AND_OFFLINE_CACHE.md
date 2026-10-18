# Player Reliability Protocol — BATCH 09

## Core principle
The player is responsible for durable local state. The API cannot guarantee offline playback or exactly-once physical execution by itself. Persist command IDs, cached asset hashes and event IDs in a local database/transactional store.

## Heartbeat
`POST /api/v1/devices/{screenId}/heartbeat`
Header: `x-device-secret: <device secret>`

Send:
- `platform`, `playerVersion`
- optional CPU, memory and storage percentage (0–100)
- optional `capabilities` object (avoid secrets and personal data)
- optional `manifestVersion`, `syncStatus` (`SYNCED` means the current manifest was applied), and `playerError`

Heartbeat every 30–60 seconds while online. Use monotonic local timing for retry intervals. The server marks ONLINE only when a heartbeat is received, but does not override an operator-set MAINTENANCE state.

## Commands
`GET /api/v1/devices/{screenId}/commands`
`POST /api/v1/devices/{screenId}/commands/{commandId}/result`

Commands may be redelivered after 30 seconds. The server caps delivery attempts at 10 and marks a still-pending command FAILED after the cap. Command expiry remains authoritative. The player MUST deduplicate by command ID and persist completion before acknowledging.

Suggested player flow:
1. Receive command and verify its expiry.
2. Look up command ID in durable local state.
3. If already applied, return the previous result without repeating side effects.
4. Apply command safely.
5. Persist terminal result.
6. Send ACKNOWLEDGED or FAILED with a short error message.
7. If offline, retain result and retry reporting when connectivity returns.

A command ACK means the player reports that the command was handled; it is not independent proof that the requested physical action succeeded.

## Offline media cache
- Download only assets referenced by a valid manifest.
- Write to a temporary file, verify expected size/hash when available, then atomically rename into the cache.
- Keep the previous known-good playlist until the replacement manifest and required assets are ready.
- Do not delete currently referenced assets until the replacement playlist is committed.
- Apply a configurable storage budget and least-recently-used eviction only to assets not referenced by the active/offline playlist.
- On connectivity loss, continue only cached content permitted by the configured offline policy.
- Never create new campaign authorizations offline. Playback telemetry may be queued locally, but events must retain their original authorization token/ID and timestamps; expired/rejected events must not be treated as eligible.
- Flush event queues in bounded batches with exponential backoff and jitter. Preserve event IDs across retries.
- When reconnecting, fetch a fresh manifest, reconcile asset hashes, upload queued events, and process pending commands.

## Security and operations
- Protect device secrets using platform secure storage; never log them.
- Do not trust client clock for authorization. Server timestamps and authorization expiry are authoritative.
- Keep diagnostics bounded and redact tokens, signed URLs, secrets and sensitive screen data.
- If cache integrity or player storage is compromised, stop using corrupted assets and report a player error.
