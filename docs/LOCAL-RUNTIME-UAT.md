# ADFLICK local compiled runtime and browser UAT

The Ubuntu developer's first-time `npm run verify` on commit `42260ea0` passed (see `docs/RELEASE-SIGNOFF.md`).

## Local-first launch (no interference with other projects)

With Node.js **24**, Docker available, and dependencies already installed by `npm run verify`, from repository root run:

```bash
git pull
npm run local:up
```

This command builds the API and web from source, launches **a uniquely named disposable MySQL 8.4 Docker container** on a random `127.0.0.1` port, deploys all approved source migrations to that temporary database, and runs the compiled API and Next.js standalone web on randomly allocated `127.0.0.1` ports. The Next build includes the actual allocated API URL; generated static JS/CSS are copied into the standalone package for correct browser rendering. Read the **Dashboard/Login/CMS** URLs printed by the script.

**No Docker Compose, no fixed 3000/3306/4000 ports, no `.env` modification, no persistent database volume, no seed data, no provider transfers, no interaction with unrelated PM2 processes/databases/vhosts**. Closing the terminal with Ctrl+C stops only spawned ADFLICK processes and deletes the disposable container. Data in that disposable database is intentionally ephemeral. Never use this command for real business data or production.

## Browser UAT

`npm run local:uat` runs the same isolated compiled runtime and uses real headless Chrome to navigate public/UI routes, trigger sidebar navigation, test CMS tab feedback, add local preview media, prepare a playlist draft, create a sample campaign and prove it does not persist, test browser form validation and unauthorized API behavior, and save screenshots into the ignored `.adflick-uat/` directory. The GitHub **Frontend CI** also runs this check and uploads screenshots as a run artifact.

On the operator's desktop, additional **manual visual UAT is still required**: inspect spacing, overflow, responsive behavior, side navigation, keyboard access, app-level error states and actual user account workflow. The UI currently includes static prototype screens and lacks an accepted physical Smart TV client. Browser UAT is not product/business approval.

## Known limitations and safety

- There is **no demo login created**. Only validate invalid/anonymous flows; do not invent account credentials or populate commercial data.
- The API is compiled with `API_HOST=127.0.0.1`, and Next.js standalone uses `HOSTNAME=127.0.0.1`. Both URLs are local to the Ubuntu machine.
- After a local test, re-run `npm run local:up` for a new clean ephemeral MySQL instance. No persistent changes survive.
- Browser screenshots from CI demonstrate execution on GitHub runners, not verification of the exact user desktop appearance; operator confirmation remains pending.
- `npm run verify` remains the authoritative full local gate; launcher/browser UAT is an additional runtime experience, not a substitute.
- Production and provider/finance approvals remain **PENDING**.

## 19 October 2026 screenshot review and safe UX corrections

The user supplied Ubuntu desktop screenshots of the overview, CMS layout, empty playlist and Campaign Management. Layouts visually rendered without major overlap. Source inspection confirmed inaccurate legacy approval/progress language, stale CMS feedback/empty playlist affordance, and demo campaign workflow controls that must not be confused with persisted/live state. Frontend fixes landed under `apps/web/app/page.tsx`, `apps/web/app/cms/*`, and `apps/web/app/campaigns/*`. CI Chrome UAT [run 39218977525](https://github.com/canzone-tech/adflick/actions/runs/39218977525) now performs CMS media/playlist tab actions and checks demo Campaign creation does not survive route reload. Physical Ubuntu acceptance of updated UI remains pending.

## Approved persistent local development (Phase 1)

After current exact-SHA CI release gates PASS, use `npm run local:dev:admin` once (interactive hidden password), then `npm run local:dev:up`. This is **not** `npm run local:up`: the latter remains disposable. Persistent data is stored only in the ADFLICK-scoped Docker volume `adflick-dev-local-v1-mysql-data`, with encrypted transport not claimed because access is loopback-only and development-only. On Ctrl+C the container is stopped but the volume persists. Any old `local:up` process must be stopped before rebuilding the same Next.js output directory. See conversion plan for UAT.

## First-time admin bootstrap fix — 19 October 2026

Ubuntu operator reported a successful root `npm run verify` but first `npm run local:dev:admin` failed with Prisma missing `User` table, since `verify` correctly ran migrations against a **different disposable database** and the persistent development volume had not yet been migrated. Additionally the old password-entry method paused (but did not close) readline and terminal characters were visibly echoed. The displayed development password must be regarded as exposed and **never reused**.

**Fix:** `scripts/prepare-first-admin-db.mjs` is now shared by the real first-admin CLI and the CI integration runner, ensuring `prisma migrate deploy` runs first on the **ADFLICK-owned persistent** MySQL URL. If migration fails, no first admin is created, and only the process-owned DB container can be stopped; the persistent volume is neither reset nor removed. `scripts/local-dev-admin.mjs` fully closes the name/email readline before entering a raw, non-echo TTY password reader; `scripts/read-hidden-password.test.mjs` validates no echo, backspace, Ctrl+C and raw-mode reset. Operator must choose a **new unique password** and should never include passwords/tokens in screenshots.

After exact-SHA Backend CI, Frontend CI and Release Evidence all pass, operator can restart from repo root with `git pull` then `npm run verify`, followed by one-time `npm run local:dev:admin` and `npm run local:dev:up`. No `docker volume rm`, `prisma migrate reset`, or Docker Compose volume operation is needed. Local gate and operator visual test remain separately pending.
