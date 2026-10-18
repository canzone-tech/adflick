# ADFLICK Player Protocol — BATCH 04

This folder documents the player-facing protocol. It is not yet a packaged Android TV, Tizen, webOS, Windows or Flutter application.

## Pairing flow
1. Operations creates a screen in the authenticated portal and receives a one-time 12-character code.
2. Code expires in 10 minutes and is stored server-side as a SHA-256 hash.
3. The player generates a cryptographically random secret of at least 32 bytes and stores it using platform secure storage.
4. Player calls `POST /api/v1/devices/pair` with `code`, `deviceSecret`, `platform`, and `playerVersion`.
5. Server consumes the code atomically, stores only the hash of the device secret, and binds the player to the registered screen.
6. The player stores the returned `screenId` with its secret. Do not log the secret.

## Heartbeat
`POST /api/v1/devices/{screenId}/heartbeat`

Header: `x-device-secret: <device secret>`

Example body:
```json
{
  "platform": "Android TV",
  "playerVersion": "0.1.0",
  "cpuPercent": 18,
  "memoryPercent": 42,
  "storagePercent": 31,
  "capabilities": { "video": ["h264"], "image": ["jpeg", "png"] }
}
```

The API currently stores device identity, version, last heartbeat, last-seen time and source IP. Detailed telemetry metrics are accepted but not yet persisted to a telemetry table.

## Poll commands
`GET /api/v1/devices/{screenId}/commands`

Header: `x-device-secret: <device secret>`

Player must execute only known command types, enforce local safety constraints, and report results:
`POST /api/v1/devices/{screenId}/commands/{commandId}/result`

Example body:
```json
{ "status": "ACKNOWLEDGED", "result": { "applied": true } }
```

## Security requirements
- Use TLS for all production traffic.
- Use Android Keystore / iOS Keychain / platform-appropriate secure storage.
- Do not embed a shared device secret in a distributed app.
- Add device secret rotation and recovery before wide deployment.
- Add stronger abuse controls and pairing attempt monitoring.
- Only permit platform-supported commands. Screenshot, restart and volume controls vary by OS and device vendor.


## BATCH 07 manifest delivery
See `PLAYBACK_MANIFEST_PROTOCOL.md` for the device-authenticated manifest endpoint and one-time playback authorization protocol. Terminal playback events must include the authorization ID/token from the manifest.
