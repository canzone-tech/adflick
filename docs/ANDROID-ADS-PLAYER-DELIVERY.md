# ADFLICK — Android Mobile and Android TV advertising delivery foundation

## Source and product intent

The provided `ADFLICK_SmartTV_LShape_Architecture-13.html` design reference describes Flutter SmartTV L-shape rendering, non-disruptive ads, D-pad input, independent ad creatives, manifest delivery, offline queue and telemetry. It depicts 75%×75% primary video, 25%×75% right-side ads and 100%×25% bottom ad region. The repository had NestJS device and manifest APIs, CMS drafts and Fleet panels, but **no native Android client**. This batch starts that client in `apps/player_flutter` (Flutter/Dart + Android host) and an opt-in trusted-image worker.

## Workflow and exact implementation boundaries

- Android app: one Flutter codebase targeting Android phone and Android TV. Pairing code and per-device generated secret use the existing backend API. The device secret uses Android-backed secure storage, not user JWT/localStorage; network calls have bounded timeouts.
- Playback: valid time-bounded manifest, signed HTTPS media URLs, fullscreen display and an **L-band preview**. Real protected primary video feed is not configured; the main area is visibly labeled. Display of actual multi-creative side/bottom placements, U/T/PIP formats, ad preloading, offline persistent queue, audio focus policy, D-pad field UAT and hardware decoding are **open work**, not claims of completion.
- Backend verification: `MediaVerificationService.verifyOne(orgId,assetId)` is a privileged, explicitly enabled process-only operation. It reads bounded S3 image bytes, compares claimed SHA-256 and exact size, decodes JPEG/PNG/WebP via Sharp, and atomically transitions only the matching tenant-owned PROCESSING asset to READY. No user-facing endpoint or auto-run process was added. Audio/video remain PROCESSING pending separate trusted decoders and media safety review.
- Replay/telemetry: grants are short-lived, server-generated and single-use at terminal events. Client reports may be accepted/rejected but are not cryptographic proof of a real play, screen visibility, campaign settlement or payout. No financial rules are enabled.
- Testing: existing Node verification includes trusted-image worker Jest tests and source-level Android manifest/API-contract tests. The independent Flutter Dart tests and real APK/TV remote/signed-media field UAT are not run by the current CI.

## Operations and approvals

The worker runner is compiled `apps/api/src/media-verification.runner.ts` and requires `MEDIA_VERIFICATION_ENABLED=1` with explicit organization and asset IDs. It refuses `NODE_ENV=production`; no background scheduling, VPS execution or object-storage provisioning. Secure development S3 credentials and worker execution require authorization; do not create buckets/services, upgrade production infra or activate automated media release without approval.

Android release workflow is a separate gate: Flutter SDK + Android SDK review, locked dependencies and Android artifact build, emulator/mobile/Android TV real tests, signed APK checks, authorized pilot devices, media source rights and ad insertion/commercial policy. Production deployment remains separately blocked by off-host encrypted backup/restore evidence, signed immutable compiled artifacts and explicit release approval.

No existing payments, commissions, member eligibility or other projects are touched.
