# ADFLICK — client-required device OS and player delivery matrix

**Scope confirmation:** 29 October 2026, project owner explicitly confirmed in the Adflick conversation that **all the platforms below are client requirements**, not optional ecosystem suggestions. This supersedes the earlier Android-only development assumption for **delivery planning**, not the current implementation status.

**Evidence boundary:** The original `ADFLICK_Binary_1x1_MLM_Complete_SRS.docx` is referenced in repository traceability but the original DOCX was not accessible for a verbatim platform-clause check during this update. This requirement is therefore **project-owner-confirmed client scope**, not a claimed quotation from the original document. Preserve the original SRS wording if/when supplied and reconcile any difference explicitly.

## Updated client Smart TV and media-player OS list (2026-10-29)

**Nine explicitly required TV platform families:** Google TV / Android TV, Tizen OS, webOS, Roku TV, Fire TV OS, Titan OS, SmartCast, Xumo TV OS and Apple tvOS. This list was supplied by the project owner as **client requirements**, not optional Fleet options. Three TV families overlap the earlier seven groups (PLAT-02 Android TV, PLAT-04 Tizen, PLAT-05 webOS); six new groups (PLAT-08…PLAT-13) expand the matrix to **13 required delivery groups, including nine TV families**. Keep previously required Android/iOS mobile/tablet and Windows/Linux media-player targets. tvOS is not iOS; Google TV and Android TV share a development OS family but require client-device acceptance separately.

**Evidence boundary:** this is owner-supplied scope, not a verified original SRS quotation, and is not acceptance of native SDKs, media rights, APKs, app-store distribution, hardware tests, commercial policy, or system-wide TV overlays.

## Required delivery targets

| ID | Client-required platform / device | Existing implementation (2026-10-29) | Platform acceptance |
| --- | --- | --- | --- |
| PLAT-01 | **Android phones and tablets** | Flutter/Dart Android source foundation in `apps/player_flutter`; native build not yet verified | **PENDING** — Android build/emulator/real phone and tablet UAT |
| PLAT-02 | **Google TV / Android TV / Android-based Smart TVs** | Same Flutter Android source and Leanback launcher/L-band preview | **PENDING** — APK, remote/D-pad, codecs, overscan, real L-band and physical TV UAT |
| PLAT-03 | **iOS phones / iPadOS tablets** | No verified iOS target build, signed app or device playback | **MISSING / PENDING** — approved Apple implementation, signing, supported iPhone/iPad UAT |
| PLAT-04 | **Samsung Smart TV (Tizen OS)** | Fleet stores platform label only; no verified Tizen application | **MISSING / PENDING** — Tizen runtime/player, remote, native media, install and real Samsung TV UAT |
| PLAT-05 | **LG Smart TV (webOS)** | Fleet stores platform label only; no verified webOS application | **MISSING / PENDING** — webOS runtime/player, remote, native media, install and real LG TV UAT |
| PLAT-06 | **Windows player devices** | Fleet stores platform label only; no verified Windows desktop/kiosk application | **MISSING / PENDING** — installer/runtime, codec, recovery and real Windows device UAT |
| PLAT-07 | **Linux player devices** | Fleet stores platform label only; no verified Linux desktop/kiosk application | **MISSING / PENDING** — distribution/architecture matrix, packaging, codec and real Linux device UAT |
| PLAT-08 | **Roku TV (Roku OS)** | No BrightScript/SceneGraph player | **MISSING / PENDING** — Roku signed app, store approval, real TV D-pad/media UAT |
| PLAT-09 | **Fire TV OS (Amazon Fire OS)** | No verified Fire TV app | **MISSING / PENDING** — Fire OS/Amazon integration and real device UAT, plus Vega OS scope decision |
| PLAT-10 | **Titan OS** | No verified Titan OS app | **MISSING / PENDING** — partner access, SDK, packaging and real TV UAT |
| PLAT-11 | **VIZIO SmartCast** | No verified VIZIO app | **MISSING / PENDING** — partner access, VIZIO OS/SmartCast model map and real TV UAT |
| PLAT-12 | **Xumo TV OS** | No verified Xumo app | **MISSING / PENDING** — Entertainment OS/Scaled stack decision, partner integration and real-device UAT |
| PLAT-13 | **Apple tvOS (Apple TV)** | No native tvOS player | **MISSING / PENDING** — Xcode/signing, AVPlayer, remote/device UAT |

**Required ≠ built ≠ tested ≠ approved.** An operator selecting a platform and registering a screen in MySQL proves only fleet registration. Existing 3× GitHub CI GREEN and root `npm run verify` cover the Node services/web plus Android source contracts, **not** the thirteen native player platform gates. Do not advertise cross-platform runtime support as delivered until each target has independent evidence.

## TV platform feasibility and vendor restrictions (not runtime approvals)

| Required TV family | SDK/runtime to evaluate | Primary blocker |
| --- | --- | --- |
| Google TV / Android TV (PLAT-02) | Android TV app; investigate existing Flutter Android code | Android/Google TV hardware, signed APK, media/remote/L-band UAT |
| Samsung Tizen OS (PLAT-04) | Tizen TV web app / platform player APIs | Per-model codecs/web-engine, signed package and TV UAT |
| LG webOS (PLAT-05) | webOS TV web app / media APIs | Per-generation web engine, signing/distribution and TV UAT |
| Roku TV (PLAT-08) | BrightScript + SceneGraph | Dedicated app, certification and player UAT |
| Fire TV OS (PLAT-09) | Fire OS Android-compatible target where supported | Amazon services and hardware. **Vega OS is a distinct runtime, not automatically covered by an Android APK** |
| Titan OS (PLAT-10) | Titan OS partner portal/docs | OEM partner authorization and SDK/device matrix |
| SmartCast (PLAT-11) | VIZIO partner application platform | Partner onboarding, current VIZIO OS model mapping and ad/privacy rules |
| Xumo TV OS (PLAT-12) | Comcast Entertainment OS or legacy Scaled stack | Partner approval and device/stack choice |
| tvOS (PLAT-13) | Apple tvOS native SDK with AVPlayer/AVKit | macOS/Xcode, signing, real Apple TV and Siri Remote UAT |

**Vendor references (independent research, not ADFLICK support proof):** [Google TV](https://developer.android.com/training/tv/get-started/google-tv), [Samsung](https://developer.samsung.com/smarttv/develop/specifications/general-specifications.html), [LG](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine), [Roku](https://developer.roku.com/dev/docs/getting-started), [Fire OS](https://developer.amazon.com/docs/fire-tv/fire-os-overview.html), [Vega OS](https://www.developer.amazon.com/apps-and-games/sdks), [Titan OS](https://www.titanos.tv/partner-portal), [VIZIO](https://www.vizio.com/en/content-partners), [Xumo](https://docs.developer.comcast.com/docs/development-stack-tools), [tvOS](https://developer.apple.com/tvos/).

**Critical blocker:** App-contained L-band advertising is not permission to draw ads on top of third-party apps, TV launcher, HDMI or external broadcast streams. OS-wide overlay and primary-video playback require a separately approved OEM/operator capability, licensing and product decision. Pairing, versioned manifests, creative grant validation, heartbeat, offline recovery, telemetry deduplication, privacy and platform-specific signed artifacts need **separate acceptance per TV OS**.

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

## Server cross-platform player protocol (first implementation slice)

A new, **device-secret-protected read-only** `GET /api/v1/devices/{screenId}/protocol?version=1` returns the server's v1 protocol, manifest schema version, scoped endpoint paths and self-reported-telemetry trust boundary. Unknown versions are explicitly rejected; the protocol endpoint does **not** mint any ad/media authorizations. It keeps existing v1 manifests backward compatible for Android and future TV clients.

See `docs/PLAYER-PROTOCOL-V1.md` for the audited response, security tests, non-goals and remaining OS adapter/SDK needs. **This protocol is backend work only:** native apps, DRM/codecs/partner approvals, TV overlays and physical UAT remain MISSING/PENDING for each platform.
