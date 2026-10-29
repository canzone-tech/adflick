# ADFLICK — client-required device OS and player delivery matrix

**Scope confirmation:** 29 October 2026, project owner explicitly confirmed in the Adflick conversation that **all the platforms below are client requirements**, not optional ecosystem suggestions. This supersedes the earlier Android-only development assumption for **delivery planning**, not the current implementation status.

**Evidence boundary:** The original `ADFLICK_Binary_1x1_MLM_Complete_SRS.docx` is referenced in repository traceability but the original DOCX was not accessible for a verbatim platform-clause check during this update. This requirement is therefore **project-owner-confirmed client scope**, not a claimed quotation from the original document. Preserve the original SRS wording if/when supplied and reconcile any difference explicitly.

## Required delivery targets

| ID | Client-required platform / device | Existing implementation (2026-10-29) | Platform acceptance |
| --- | --- | --- | --- |
| PLAT-01 | **Android phones and tablets** | Flutter/Dart Android source foundation in `apps/player_flutter`; native build not yet verified | **PENDING** — Android build/emulator/real phone and tablet UAT |
| PLAT-02 | **Android TV / Android-based Smart TVs** | Same Flutter Android source and Leanback launcher/L-band preview | **PENDING** — APK, remote/D-pad, codecs, overscan, real L-band and physical TV UAT |
| PLAT-03 | **iOS phones / iPadOS tablets** | No verified iOS target build, signed app or device playback | **MISSING / PENDING** — approved Apple implementation, signing, supported iPhone/iPad UAT |
| PLAT-04 | **Samsung Smart TV (Tizen OS)** | Fleet stores platform label only; no verified Tizen application | **MISSING / PENDING** — Tizen runtime/player, remote, native media, install and real Samsung TV UAT |
| PLAT-05 | **LG Smart TV (webOS)** | Fleet stores platform label only; no verified webOS application | **MISSING / PENDING** — webOS runtime/player, remote, native media, install and real LG TV UAT |
| PLAT-06 | **Windows player devices** | Fleet stores platform label only; no verified Windows desktop/kiosk application | **MISSING / PENDING** — installer/runtime, codec, recovery and real Windows device UAT |
| PLAT-07 | **Linux player devices** | Fleet stores platform label only; no verified Linux desktop/kiosk application | **MISSING / PENDING** — distribution/architecture matrix, packaging, codec and real Linux device UAT |

**Required ≠ built ≠ tested ≠ approved.** An operator selecting a platform and registering a screen in MySQL proves only fleet registration. Existing 3× GitHub CI GREEN and root `npm run verify` cover the Node services/web plus Android source contracts, **not** the seven native player targets. Do not advertise cross-platform runtime support as delivered until each target has independent evidence.

## Cross-platform contract (every target, required before acceptance)

1. Register a tenant-scoped device; complete single-use pairing with a protected device secret and server-side revocation/rotation handling. Never embed operator JWTs or provider credentials in a player package.
2. Verify HTTPS/TLS, signed/expiring media URLs, manifest schema/version, campaign/schedule targeting, creative readiness, and denied/expired/unassigned ads. Fail closed, no fabricated impressions.
3. Play approved image/video creatives with real platform decoder, audio/visibility rules, resolution/orientation/overscan requirements, and approved fullscreen / L-band overlays **where applicable**. A primary TV feed must be licensed and connected before calling an L-band integration complete.
4. Recover from network loss, restarts, offline cache/replay, expired grants, token revocation and player upgrades without duplicate billable records. Keep persistent queues encrypted/bounded, and server-authorized.
5. Emit deduplicated device-scoped events, heartbeat/device health and auditable diagnostics. Device-reported playback is **not independent proof of actual display**, reward eligibility or payment approval.
6. Provide platform-specific SDK builds, dependency locks, signed native artifacts, target OS/version and hardware matrix, real UI and remote/touch/keyboard behavior, functional playback smoke, error recovery and security review.
7. Record immutable Git SHA, release artifact checksum, per-platform UAT logs, device model, OS/runtime/codec versions, reviewer, known defects, rollback/update path and **separate product approval**.

## Architecture and scope guardrails

- Keep NestJS REST/MySQL authoritative for campaigns, media, manifests, device registration and playback validation. Use a versioned shared player API contract to avoid per-platform business rule duplication.
- `apps/player_flutter` is **Android-first implementation only**. Flutter might support other targets, but Flutter support does **not** establish an approved, working Tizen, webOS, Windows, Linux or iOS player; review platform SDK/runtime/codec feasibility before committing implementation technology.
- Reuse presentation/state machine components only after platform-specific evidence; support for one TV OS does not imply another. Maintain phone, tablet and TV UI/remote variants independently.
- Requirements are confirmed, but **implementation stack/OS minimum versions, named hardware models, supported codecs, release channels and provider/commercial policies** still need client/product acceptance. Do not silently invent them.
- This is a functional-scope clarification; **no production deployment, provider activation, payment, compensation, legal claims, or financial rule changes** are authorized.
