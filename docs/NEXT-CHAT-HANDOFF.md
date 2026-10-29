# ADFLICK — new-chat engineering handoff (2026-10-29)

**Repository:** `canzone-tech/adflick` — https://github.com/canzone-tech/adflick  
**Working branch:** `dev/local-foundation` (not `main` or `development`)  
**Scope:** Adflick only. Never use another project's secrets, assets, databases, rules or VPS resources.

## First action when this document is read

1. Fetch live `dev/local-foundation` HEAD and inspect `AGENTS.md`, `docs/DEVELOPMENT-DELIVERY-RULES.md`, `docs/CLIENT-PLATFORM-SUPPORT.md`, `docs/SRS-V1-DELIVERY-BACKLOG.md`, `docs/SRS-V1-TRACEABILITY.md`, `docs/ANDROID-ADS-PLAYER-DELIVERY.md` and changed source. Do **not** assume the snapshot SHA below is still HEAD.
2. Use the connected GitHub account **`canzone-tech`** for this repository, and check permissions/branch before committing. Do not edit other GitHub accounts/projects.
3. Find the actual workflow runs and artifacts for the live exact SHA: Backend CI, Frontend CI, Release Evidence. Report each conclusion precisely; never reuse green from a parent SHA.
4. After all three workflows succeed on exactly the same SHA, request **one** repository-root `git pull` followed by `npm run verify`; user-reported local output and `git rev-parse HEAD` establish local PASS and SHA parity. Earlier user local PASS does not transfer to a newer SHA.
5. No production switch or media/provider/financial activation from CI alone; separate release-specific approval and recovery evidence are mandatory.

## Source/evidence snapshot before this handoff-only commit

- **Pre-handoff branch SHA:** `b2bc0567700e43231bc92176240e9a99e53b62f9`.
- At that SHA, GitHub runs were checked and **completed/success**: Backend CI [40837600377](https://github.com/canzone-tech/adflick/actions/runs/40837600377), Frontend CI [40837600267](https://github.com/canzone-tech/adflick/actions/runs/40837600267), Release Evidence [40837600344](https://github.com/canzone-tech/adflick/actions/runs/40837600344).
- The immediately preceding Android player and image-verification source commit `4a01ba5f87cac40bc97a7b8a8b18cf3e7b366e21` had Backend CI, Frontend CI and Release Evidence PASS on that earlier SHA, plus separate Migration Compatibility Diagnostics PASS. Backend included 315/315 unit, 7/7 security, 43/43 member MySQL, 4/4 real operations MySQL and 14/14 finance integration tests.
- **Most recent user-reported local verification at the time of this document was for older SHA `6d1882c02f059901e97c127a6f699c84fc632855`,** not the Android/native-platform commits. Local `npm run verify` for this handoff's new SHA is therefore **PENDING** until the operator confirms it.
- Never label an Android APK, Flutter/Dart test suite, hardware-player UAT or any other native platform **PASS** merely because Node CI is green.

## Product clarification — client requires multiple player operating systems

On **2026-10-29** the project owner explicitly confirmed in chat that **all seven player target rows** are client requirements, **not** merely options in the Fleet dropdown:

| ID | Required advertising device target | Current evidence/status |
| --- | --- | --- |
| PLAT-01 | Android phone/tablet | Flutter source only; native build/real mobile UAT pending |
| PLAT-02 | Android TV/Android-based Smart TV | Flutter + Leanback + L-band preview source; native/real TV UAT pending |
| PLAT-03 | iOS/iPadOS | No accepted player, signing or device UAT |
| PLAT-04 | Samsung Tizen Smart TV | No accepted Tizen app or real-TV UAT |
| PLAT-05 | LG webOS Smart TV | No accepted webOS app or real-TV UAT |
| PLAT-06 | Windows advertising player devices | No accepted Windows installer/runtime UAT |
| PLAT-07 | Linux advertising player devices | No accepted distro-specific package/runtime UAT |

This is **project-owner-confirmed client requirement**; the original `ADFLICK_Binary_1x1_MLM_Complete_SRS.docx` was not directly available for verbatim OS-clause citation. Never present a reconstructed SRS quote as original text. `docs/CLIENT-PLATFORM-SUPPORT.md` is the authoritative project scope/acceptance matrix. **Required ≠ implemented ≠ device-verified.**

The primary product purpose is **to actually display ads on mobile phones/tablets and Smart TVs/player devices**. Preserve CMS/campaign/manifest/secure device pairing and playback delivery APIs as the shared cross-platform contract; implement/test each native player target separately. Use Flutter where proven suitable, not as proof that Tizen/webOS/Windows/Linux/iOS binaries exist.

## Implemented technical state and remaining gaps

- Next.js + TypeScript web, NestJS + TypeScript REST, MySQL 8.4 + Prisma, Node.js 24, Docker isolated disposable MySQL for root verification. Existing CMS/Fleet/Campaign pages have real authenticated tenant-scoped MySQL panels alongside clearly marked local preview features.
- `apps/player_flutter` contains **Android-only source foundation**: secure pairing, manifest, fullscreen image/video display, heartbeat, self-reported playback events, Android TV Leanback launcher and L-band UI. No verified Flutter SDK build, emulator/physical device tests, independently verified primary video feed, complete multi-zone live playback, TV remote/UAT, offline durable queue or signed release package.
- `apps/api/src/cms/media-verification.service.ts` contains opt-in, default-off trusted JPEG/PNG/WebP processing: bounded private object read, SHA-256, actual decoder check, tenant-scoped atomic PROCESSING→READY and audit. It must not run as an automatic public upload endpoint; video/audio verification remains pending.
- CMS assets/playlist/layout drafts, campaign DRAFT/submit-for-review, inventory/health and explicit one-time device registration are present; they do not equate to scheduled/live client-approved advertising or actual signed hardware playback.
- Technical member/referral/phone/email OTP and enrollment portions exist but are not blanket SRS product acceptance. SMS provider, member activation, financial packages, commissions and payouts require separate policy/legal/provider approval.
- **Production NOT DEPLOYED as part of these player/platform batches.** No real encrypted off-host backup/isolated restore, production rollback, scoped VPS release or external smoke evidence is claimed for them.

## Recommended continuation (new chat)

1. **Verify the latest GitHub exact-SHA gate and user local gate** before working on new code.
2. Read the seven-platform contract and inspect `apps/player_flutter`, device/manifest/playback endpoints and current CI workflows. Draft an evidence-based **OS implementation feasibility/dependency matrix** (native SDK, media codec/DRM and remote UX, signing, emulator/real-device access); record unknown minimum OS/device models for product decision, not guesswork.
3. Propose an **Android Flutter compile + Dart test + Android TV/mobile emulator gate** that builds an actual APK only with approved CI/tooling changes. Do not confuse source-contract lint with native compilation. If an SDK/runner decision changes infrastructure, obtain approval first.
4. Design a versioned cross-platform device/player manifest and telemetry contract and **scope one small implementation batch** with real tests. Prioritize delivery to required Android phones/TVs while planning Tizen/webOS/iOS/Windows/Linux as mandated, not optional extras.
5. Each batch: actual repo inspection → code/tests/docs on `dev/local-foundation` → commit/push normally → same SHA Backend/Frontend/Release Evidence GREEN → one user `git pull` and `npm run verify` → separate user local confirmation. For production, obtain exact-release approval, real off-host encrypted backup+isolated restore, checksum-verified source-free artifact, scoped rollback, actual device/HTTPS smoke and visual UAT.

## Immutable safety and reporting rules

- Keep unrelated repos and VPS apps untouched; no force push; never expose secrets or credentials.
- Project policy changes, payment/reward eligibility, real provider integrations, infrastructure changes and production deployments need distinct explicit approval. No invented compensation, payment, ad-rate or device-reward promises.
- MySQL is authoritative for financial records. Device-reported playback or fleet registration is not independent proof of an ad actually shown or a payout trigger.
- Report changed paths, branch/exact SHA, three CI statuses, local verification (PASS/PENDING/FAIL), Android and other native device UAT (separate), deployment/rollback/smoke states and concrete blockers.
