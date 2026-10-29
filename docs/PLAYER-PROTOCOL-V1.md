# ADFLICK — player protocol discovery v1 (development-only contract)

**Scope:** All **PLAT-01…PLAT-13** client groups share the NestJS/MySQL device/manifest/playback transport. This document records the server's protocol capabilities, **not** the existence of native Roku, Tizen, webOS, Fire OS, Titan, VIZIO, Xumo or Apple TV applications, hardware UAT, OTT certification or OS-wide ad rights.

## Authenticated read-only discovery

`GET /api/v1/devices/{screenId}/protocol?version=1` with `x-device-secret: <device-specific secret>`.

- Device must be paired and not PENDING_PAIRING, SUSPENDED or RETIRED. Authentication/revocation uses **exactly the existing manifest device-secret hash comparison**; no operator JWT is accepted in place of the secret.
- Omitting `version` defaults to v1 for simple/legacy integrations. An unsupported version responds **406 Not Acceptable** after credential validation. Missing/wrong/revoked credentials return **403 Forbidden**. Endpoint has the same per-device request throttle family as the manifest and **Cache-Control: no-store**.
- The response has no bearer secret, hash, organization ID, media URL, playback grant, personal identity or financial eligibility claim. It does not call storage, mutate the DB or mint a playback authorization.
- Device-side implementations **must** fail closed on unsupported protocol/manifest versions, respect HTTPS in release, store per-device secrets securely and treat feature/codec/overlay support as independently tested. A Fleet platform label and client-reported heartbeat capabilities are never proof of hardware support.

### v1 example response (illustrative device ID)

```json
{
  "protocolVersion": 1,
  "manifestSchemaVersion": 1,
  "screen": { "id": "screen-a", "platform": "Android TV" },
  "authentication": { "scheme": "DEVICE_SECRET", "header": "x-device-secret" },
  "endpoints": {
    "manifest": "/api/v1/devices/screen-a/manifest",
    "heartbeat": "/api/v1/devices/screen-a/heartbeat",
    "playbackEvents": "/api/v1/devices/screen-a/playback/events",
    "commands": "/api/v1/devices/screen-a/commands"
  },
  "telemetry": {
    "playbackAuthorizationRequired": true,
    "evidence": "SELF_REPORTED_ONLY"
  }
}
```

**Manifest v1 unchanged:** Existing `GET /devices/{id}/manifest` returns time-limited authorized creative entries, and the client must not reinterpret `protocol` response as a manifest or ad permission. Telemetry requests remain bound to individually issued authorization, server replay/expiry rules and audit. Terminal playback is **self-reported only**, never independent screen visibility proof or reward/payout authorization.

## Non-goals and acceptance

No capability JSON claims that client hardware can decode a specific codec or render OS-wide overlays. There is no cross-OS Flutter executable, native build, DRM enablement, provider enrollment, production environment, schema migration or changed financial rule in this batch.

**Automated unit gate:** `apps/api/src/delivery/delivery.protocol.spec.ts` covers successful discovery, exact response shape, v1/unknown-version negotiation, credential isolation, disallowed statuses and absence of storage/grant/mutations. The endpoint is built/linted/typechecked with backend CI; the existing browser UAT and root `npm run verify` remain mandatory separately. **Real device protocol UAT and native players: PENDING.**

Next development approval gate: decide SDK/build/test-device availability for Android TV (and Fire OS models) and the separately required vendor/OEM TV platform adapters. Preserve `docs/CLIENT-PLATFORM-SUPPORT.md` as the scope authority.
