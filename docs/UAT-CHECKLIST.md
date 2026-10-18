# UAT checklist — evidence PENDING

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
