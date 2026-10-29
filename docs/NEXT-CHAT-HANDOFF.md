# ADFLICK — new-chat engineering handoff (2026-10-29)

**Repository:** `canzone-tech/adflick` — https://github.com/canzone-tech/adflick  
**Working branch:** `dev/local-foundation` (not `main` or `development`)  
**Scope:** Adflick only. Never use another project's secrets, assets, databases, rules or VPS resources.

## Local operator test plan ready for new exact-SHA gate

Added `docs/LOCAL-END-TO-END-TEST-PLAN.md` with beginning-to-end Ubuntu local test sequence, root verify, guest automated browser, first-admin-aware persistent MySQL runtime, manual staff/CMS/Fleet and versioned device-protocol tests, all 13 OS UAT blockers, PASS/FAIL/BLOCKED evidence and no-production controls. Historical user local PASS at `335a3cae76b965fef74f355befda0c587615f510` does **not** auto-approve the plan-documentation SHA. Recheck branch HEAD and three CI workflows before requesting new `git pull` / `npm run verify`.

## New-chat scope update — required nine TV/media-player OS platforms

Client names: **Google TV / Android TV; Tizen OS; webOS; Roku TV; Fire TV OS; Titan OS; SmartCast; Xumo TV OS; tvOS (Apple)**. Three overlap the earlier seven targets, six are additional, yielding **PLAT-01…PLAT-13** and preserving mobile/iOS/Windows/Linux. See `docs/CLIENT-PLATFORM-SUPPORT.md` for current requirements, feasibility and hardware blockers; older seven-item handoff below is historical context. Fleet OS labels and contract tests track these targets, but they do not prove native players exist. Do not claim CI, user local verification, physical OS devices, production or app-store partners PASS without exact evidence.

## Chat rollover inventory — 2026-10-29 (unintegrated incoming attachments)

**At this checkpoint:** branch HEAD was `cbfabea201c49c1bbbfc13be5f647899c0a012dc` prior to this addendum. Backend CI was reported **SUCCESS** on this previous HEAD ([run 40838826247](https://github.com/canzone-tech/adflick/actions/runs/40838826247)), while Frontend CI ([40838826248](https://github.com/canzone-tech/adflick/actions/runs/40838826248)) and Release Evidence ([40838826332](https://github.com/canzone-tech/adflick/actions/runs/40838826332)) were **IN PROGRESS** when checked. These are **not** evidence for the new handoff commit. Re-query all three on the new exact HEAD. Operator local `npm run verify`, native player builds/UAT, backup/restore and production are **PENDING/NOT VERIFIED** for the new SHA.

The user uploaded the following materials in the closing chat. They were **not copied into Git**, and are **not automatically guaranteed to be accessible in a new chat**. File sizes and SHA-256 are computed from the conversation's local file copies; ZIP member listings were opened, but the source archives were **not independently reconciled, scanned for secrets, installed, compiled, or test-executed**. Do not import these into the public repo until separately reviewed and approved.

| Attached file | Bytes | SHA-256 |
| --- | ---: | --- |
| `ADFLICK_PLAYOUT_BATCH_051_100_RECOVERY_BUNDLE.zip` | 15,751 | `f476c27214e0391b959d23d4aff18fc3c623436b5d27b070f702b28bd40f2721` |
| `ADFLICK_PLAYOUT_BATCH_101_150_SINGLE_BUNDLE.zip` | 350,442 | `49f73282fb766a38f0c37a4988998e73cf53ad217fec731845b3970f8057613a` |
| `ADFLICK_PLAYOUT_CMS_BATCH_01-50_MASTER_BUNDLE.zip` | 19,217,253 | `8f3a140824d9023fc38da55160ec038700ca8bb7cee2a439db76f0d0f8992390` |
| `ADFLICK_PLAYOUT_CMS_BATCH_01_SOURCE.zip` | 23,048 | `3a90b858415b817c5648d8ab9be755c14c4801cd0f9256411b61f9503c38e676` |
| `ADFLICK_PLAYOUT_CMS_BATCH_02_COMPLETE_SOURCE.zip` | 36,582 | `1224ee741b9da9349930643c468b8aece08836805b0dbed248f100f9bfd0f67a` |
| `ADFLICK_PLAYOUT_CMS_BATCH_03_COMPLETE_SOURCE.zip` | 54,822 | `255edf57cd216c1f928bf642babef842f10c9045e13afd677764788651adb6f5` |
| `ADFLICK_PLAYOUT_CMS_BATCH_04_COMPLETE_SOURCE.zip` | 72,464 | `1c7bba22aceab61491db4bf279caf3e8d2286b37632a5ecd943aedc82cc7477d` |
| `ADFLICK_PLAYOUT_CMS_BATCH_05_COMPLETE_SOURCE.zip` | 88,073 | `7d512d689825da81283ce0e9d3509feff1bc963933481db9823451f3a27dcaaa` |
| `ADFLICK_PLAYOUT_ENGINEERING_BATCH_IMPLEMENTATION_GUIDE.docx` | 46,000 approx. | `65ffbb1a37670bff4b57f74d946b3a3d0818e89a446f9284e8dc6667f970f89b` |
| `ADFLICK_PLAYOUT_MASTER_SOURCE_RECOVERY_BATCH_001_150_AUDIT_BUNDLE.zip` | 43,518 | `4e94dc8b848959b63afc2cdae0276ce7b82c1b593541da419d9b98d48d2a5f8e` |
| `ADFLICK_SmartTV_LShape_Architecture-13.html` | 76 KB approx. | `553b53fe4162b6407525acfec9a1d58aaa6f7f8a26ec07df0c7ec6221e0e0526` |

**Observed archive listings:** The 051–100 bundle has 8 metadata/register/notes entries, not proven full source for those batches. The 101–150 bundle contains 49 nested archives named Batch 102 through 150 plus one manifest; no Batch 101 source was listed. The 001–050 master bundle has 52 outer entries, including nested batch ZIPs and a candidate latest Batch 50 ZIP; no source comparison/integration was performed. The audit bundle has 5 documentary/register entries. Small ZIP archives passed a basic CRC read; the 19 MB master did **not** undergo a complete CRC check. The HTML is a Smart TV layout **reference simulator**, not real TV/player UAT.

**Engineering guide's constraint:** The attached engineering guide describes source recovery and Batch 001–150 reconciliation as *not yet evidenced*, prohibits blind ZIP overlay and starting Batch 151 before reconciliation, and requires a batch register, hash-based provenance, isolated extraction, review, tests and acceptance. Treat files as new recovery inputs, not proof that all 150 batches are complete. Existing SRS/product approvals and platform requirements remain separately governed by repo documents.

**Next chat priority:** Inspect live branch HEAD + exact-SHA workflows first. If the owner wants archive recovery next, request reattachment/access to these exact hashed files if unavailable; review manifests and scan isolated content against the canonical repo, update the consolidated `docs/BATCH-HISTORY.md` with evidence rather than generating 150 unnecessary files, and never activate business rules or production from untrusted archives.

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

## Next verified engineering slice — authenticated shared player protocol v1

First code batch after 9-platform scope reconciliation adds `GET /api/v1/devices/{screenId}/protocol?version=1`: read-only, existing device-secret authentication and revocation, supported v1/406 negotiation, returned scoped endpoint paths and explicitly self-reported proof-of-play status. API does not create media grants, expose secrets or modify financial rules or old manifest v1. Backend Jest regression file and `docs/PLAYER-PROTOCOL-V1.md` explain acceptance. **Native TV SDKs/apps, signed binaries, hardware UAT, local verify at any new SHA and deployment remain separately pending.** Check the actual live commit/CI before claiming any gate passes.
