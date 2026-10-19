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

`npm run local:uat` runs the same isolated compiled runtime and uses real headless Chrome to navigate public/UI routes, trigger sidebar navigation, test browser form validation and unauthorized API behavior, and save screenshots into the ignored `.adflick-uat/` directory. The GitHub **Frontend CI** also runs this check and uploads screenshots as a run artifact.

On the operator's desktop, additional **manual visual UAT is still required**: inspect spacing, overflow, responsive behavior, side navigation, keyboard access, app-level error states and actual user account workflow. The UI currently includes static prototype screens and lacks an accepted physical Smart TV client. Browser UAT is not product/business approval.

## Known limitations and safety

- There is **no demo login created**. Only validate invalid/anonymous flows; do not invent account credentials or populate commercial data.
- The API is compiled with `API_HOST=127.0.0.1`, and Next.js standalone uses `HOSTNAME=127.0.0.1`. Both URLs are local to the Ubuntu machine.
- After a local test, re-run `npm run local:up` for a new clean ephemeral MySQL instance. No persistent changes survive.
- Browser screenshots from CI demonstrate execution on GitHub runners, not verification of the exact user desktop appearance; operator confirmation remains pending.
- `npm run verify` remains the authoritative full local gate; launcher/browser UAT is an additional runtime experience, not a substitute.
- Production and provider/finance approvals remain **PENDING**.
