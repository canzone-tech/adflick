# UAT checklist — technical PASS / product sign-off PENDING

- [ ] MySQL 8.4 clean migration from an empty disposable database; upgrade rehearsal from approved prior schema.
- [ ] API compiled process boots: `GET /api/v1/health` 200; `GET /api/v1/ready` 200 with disposable MySQL ready; unauthenticated `GET /api/v1/auth/me` 401.
- [ ] Public dashboard root renders; `/login`, `/cms`, `/fleet`, `/finance` pages return HTML without server error.
- [ ] Auth login/refresh/logout and server-enforced role checks including cross-tenant denial.
- [ ] Campaign creation, approval, schedule, playlist/device sync, offline recovery with expected state transitions.
- [ ] Proof-of-play valid/duplicate/late/malformed/replayed event rejection and reporting.
- [ ] Finance maker-checker, idempotency, concurrency, duplicate import processing, negative cases and no live transfer.
- [ ] TV player: real platform build, D-pad/focus, ad overlay playback, connectivity loss/restart, valid player telemetry.
- [ ] Responsive screenshots and real browser keyboard/touch UAT at target breakpoints.
- [ ] Encrypted off-host backup, isolated restore, scoped rollback, external HTTPS and unrelated service isolation.

Each line requires real test log, reviewer, SHA and PASS/FAIL/BLOCKED. Static source checks alone cannot close a line.

## Ubuntu desktop visual review (user-submitted screenshots, 19 October 2026)

**Partial desktop preview review, not full functional or business UAT.** User submitted four Chrome-on-Ubuntu screenshots: overview, CMS layout editor, CMS playlist tab, and Campaign Management. At the captured desktop size there is **no observed major overlap, blank page, sidebar clipping, or broken canvas rendering**. The 68% main / 32% side zone arrangement is rendered as intended. This visual observation does not establish backend persistence, active devices, stored media, or successful operator login.

**Issues found in screenshots and corroborated in source**:
- Dashboard misleadingly displayed "APPROVED PRODUCT BASELINE", Batch 01 progress/completion cues and seven data models even though the current project is an unapproved development prototype with 18 migrations. Fix: honest development/demo text and removal of hardcoded percentage progress.
- CMS playlist tab could show a **stale Media Library validation message** and a clickable draft-save button when no preview assets were selected. Fix: per-tab context feedback, disabled zero-item draft button, and non-persistence wording.
- Campaigns screen showed sample budgets, approval/activation controls and a new locally-created row that might be mistaken for persisted/real operations. Fix: prominent **above-the-fold "Demo workspace"** disclaimer; no API calls or finance operations introduced.

**Automated follow-up:** [Frontend CI Chrome UAT](https://github.com/canzone-tech/adflick/actions/runs/39218977525) verified 12 rendered routes, Chrome desktop/mobile screenshots, sidebar click, login required-field validation, unauthorized API HTTP 401, CMS tab/asset/playlist interactions, and Campaign draft creation **plus reload non-persistence** on code commit `18089b10cdf0721d6be4bf71edfcab3b3d4e0f06`. CI artifact `adflick-browser-uat` contains screenshots. This test uses isolated disposable MySQL and does not claim physical Ubuntu or Smart TV browser UAT.

**Open:** visual approval of the **updated** UI on the user's own Ubuntu browser, keyboard-only focus and responsive/touch interaction, real authenticated backend save flows, readability of the existing 8–11px prototype metadata, API loading/error UX, screen-player integration, and business/provider approval. User screenshots are intentionally **not committed** because they include desktop/browser chrome and other personal context.

