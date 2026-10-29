# Technical stack — observed vs policy

Observed Batch-50 source: Next.js 15 / React 19 / TypeScript dashboard; NestJS 11 REST API; MySQL 8.4 via Prisma 6; npm workspaces (`apps/api`, `apps/web`, `packages/shared`); Node 24 chosen for this foundation; GitHub Actions. Redis 7 and MinIO are declared optional local dependencies; verify actual runtime usage per module.

The recovered HTML Smart TV prototype is a **simulation**. A Flutter/Dart device application is NOT present in the verified Batch 50 source. Do not claim Android TV/Flutter device UAT.

Retain production boundaries: independent Ubuntu app account / PM2 / Apache vhosts, private service ports, source-free compiled artifacts, versioned config, and authorized migrations. Production setup is **not provisioned or approved** here.

MySQL is the transactional source of truth. Redis, event queues and object storage must never become authoritative ledgers.

## Android player development module

`apps/player_flutter` is a source-only Flutter Android phone/Android TV advertising client aligned with the project's provided SmartTV L-band architecture. It is outside the npm workspaces and is **not compiled, packaged or signed** by the three Node CI workflows. The root Node verification now performs a static Android player/API contract check only; Dart/Flutter/Android compilation, emulator tests and physical device evidence are separate uncompleted acceptance gates. `apps/api/src/cms/media-verification.service.ts` adds an explicitly disabled-by-default trusted JPEG/PNG/WebP verification path; audio/video verification still requires reviewed external media decoding infrastructure. Refer to `docs/ANDROID-ADS-PLAYER-DELIVERY.md`.

## Client-required cross-platform player coverage (scope confirmed 2026-10-29)

**Required targets**, not merely optional ideas: Android phones/tablets, Android TV, iOS/iPadOS, Samsung Tizen Smart TVs, LG webOS Smart TVs, Windows players and Linux players. See `docs/CLIENT-PLATFORM-SUPPORT.md` for PLAT-01…PLAT-07 and statuses. The existing `apps/player_flutter` Dart source is an **Android-specific foundation** and must not be presented as implementing all platforms. The API/MySQL/scheduler/media/auth services should remain platform-neutral with versioned contracts. Select per-target SDK/runtime/DRM/codec/signing technology only after feasibility review; Flutter cannot be presumed to run as a compliant app on Samsung Tizen or LG webOS. No new OS app/build/runtime is provisioned by this scope update.

## New nine-TV OS obligation — 2026-10-29

Mandatory Google TV / Android TV, Tizen OS, webOS, Roku TV, Fire TV OS, Titan OS, VIZIO SmartCast, Xumo TV OS and Apple tvOS (PLAT-02, PLAT-04, PLAT-05, PLAT-08…PLAT-13). Three overlap previous TV scope; **13 tracked groups** preserve Android/iOS mobile/tablet and Windows/Linux. Reuse existing versioned NestJS/MySQL device, manifest, asset authorization and telemetry APIs across native clients. Roku BrightScript/SceneGraph, tvOS Swift/AVPlayer, Tizen/webOS web engines and Titan/VIZIO/Xumo partner frameworks each need independent SDK, signing, remote, codec, reliability and physical TV acceptance. Fire OS Android compatibility does not imply Vega OS compatibility. Existing Flutter source remains Android-only and no OS-wide video overlay is authorized.
