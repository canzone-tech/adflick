# BATCH 04 — Device fleet, pairing and remote commands

## Delivered source
- `ScreenStatus` lifecycle: PENDING_PAIRING, ONLINE, OFFLINE, MAINTENANCE, SUSPENDED, RETIRED.
- One-time pairing codes with expiry and hashed storage.
- Per-device opaque secret; only SHA-256 digest is stored.
- Atomic one-time code consumption.
- Organization-scoped fleet inventory and screen registration.
- Heartbeat and command-poll endpoints authenticated with device secret.
- Remote command queue with TTL, acknowledgement/failure and expiry.
- Route-level role restrictions and request throttling on device endpoints.
- Responsive `/fleet` interface preview.
- Player protocol notes in `player-sdk/README.md`.

## User endpoints
| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/fleet/screens` | Super Admin, Organization Admin, Operations, Support, Auditor |
| POST | `/api/v1/fleet/screens` | Super Admin, Organization Admin, Operations |
| POST | `/api/v1/fleet/screens/:id/commands` | Super Admin, Organization Admin, Operations |
| PATCH | `/api/v1/fleet/screens/:id/status` | Super Admin, Organization Admin, Operations |

## Player endpoints
| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/devices/pair` | One-time pairing code; throttled |
| POST | `/api/v1/devices/:id/heartbeat` | Device secret |
| GET | `/api/v1/devices/:id/commands` | Device secret |
| POST | `/api/v1/devices/:id/commands/:commandId/result` | Device secret |

## Command types
- REFRESH_PLAYLIST
- RESTART_PLAYER
- RELOAD_APP
- SET_VOLUME (requires integer `payload.volume` from 0 to 100)
- TAKE_SCREENSHOT
- SYNC_TIME

Commands expire after 30–3600 seconds; default 300 seconds.

## Status semantics
- ONLINE is set on a valid heartbeat.
- Stale ONLINE screens are marked OFFLINE after 2 minutes when fleet inventory is queried.
- SUSPENDED and RETIRED devices cannot authenticate.
- Device heartbeats and command polling are API protocol foundations; WebSocket push delivery and reliable background execution are later work.

## Security and production gaps
- Pairing code is 12-character hexadecimal code and expires in ten minutes. The endpoint is rate limited; deploy behind TLS and monitor failed pairing attempts.
- This batch hashes the device secret, but does not implement secret rotation, device revocation tokens, per-device certificate pinning, or automated compromise response.
- Device telemetry values are validated but only basic heartbeat identity fields are persisted.
- `TAKE_SCREENSHOT`, restart and volume commands may not be supported on all platforms. Player must capability-check before execution.
- Fleet screen and pairing workflows need automated integration tests against MySQL before release.
- The `/fleet` UI is a local preview and is not yet connected to the API.
- Organization scope is derived from the authenticated user. A Super Admin without an organization context must select an explicit organization; implicit cross-tenant access is intentionally blocked.
