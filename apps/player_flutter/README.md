# ADFLICK Android Mobile + Android TV advertising player foundation

This is a **development-only Flutter application**, targeting one Android package with both touch and Android TV Leanback launchers. It consumes existing device-scoped REST endpoints; it is **not** the administrative CMS and it does not create advertising policies.

## Device workflow

1. An authorized organization staff user creates a screen through **Fleet** and sees a single-use, 10-minute pairing code. The code must be entered into the player along with an approved **HTTPS** API server origin.
2. The player generates a 32-byte random device secret, sends `POST /api/v1/devices/pair`, and stores the server-returned screen ID and secret in Android-backed `flutter_secure_storage`. No staff JWT is stored in the player.
3. It heartbeats with `x-device-secret` and fetches `GET /api/v1/devices/{id}/manifest`. Only a valid, unexpired version-1 manifest and entries with server-issued authorization are considered. A screen with no authorized READY creative stays idle.
4. Images are displayed via the Flutter image decoder and video creatives via `video_player`. Fullscreen ad mode works as a standalone ad player. The **L-band preview** follows the supplied 75%-primary, 25%-right-ad, 25%-bottom layout. No primary TV-channel source is connected, so the main zone is a **clearly identified placeholder**, not a simulated live channel.
5. Playback events are sent with the server-issued grant. They are **self-reported telemetry**, not independent proof of display, reward eligibility or payment authorization. One-time grants are not intentionally replayed after terminal events.

## No unsupported production claims

The Node/Nest CI additionally checks Flutter source, Android manifest and backend device contract consistency; **it does not execute Flutter/Dart tests, compile an APK, or certify Android hardware behavior**. The `test/player_models_test.dart` suite must pass in a separately authorized Flutter/Android SDK environment. Android TV remote D-pad, hardware codecs, focus, varying Android resolutions, connectivity, foreground/background restrictions, offline persistent queue, app signing, Play Store and unattended kiosks all require real hardware/emulator UAT.

The sample Android TV banner uses a placeholder background; an approved production graphic is separately required. No SDK path, signing keys, server host, media URL, credentials, or device identifier is committed.

Security: release traffic requires HTTPS and trusted certificates. Only emulator/loopback HTTP is allowed in Flutter debug code. Android manifest disables cleartext traffic. On-device keys should be additionally verified on supported OEM TV firmware.

## Build blocker and approval boundary

No Flutter SDK/Android Gradle build is part of the existing three Node-based GitHub checks; those checks alone **must never** be used to claim Android package PASS. Flutter SDK, signed build, Android-specific CI and field testing require a separate reviewed environment/approval. Do not ship to real advertising screens, enable live delivery, force kiosk behavior, or turn on any payout/finance feature until explicitly authorized.
