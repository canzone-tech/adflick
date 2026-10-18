# Batch 48 — Clean CI Dependency Installation

## Purpose
Add an explicit Node/npm/workspace preflight and move CI from an unconstrained `npm install` directly to `npm ci`.

## CI behavior
1. Checkout and install Node 22.
2. If `package-lock.json` is missing, generate a CI-local lockfile with `npm install --package-lock-only` and emit a warning.
3. Verify Node/npm versions, workspace manifests, and lockfile metadata.
4. Install from the resulting lockfile with `npm ci`.
5. Continue existing static, schema, migration, typecheck, lint, unit, E2E and build stages.

## Important reproducibility limitation
The source archive does not include a committed root `package-lock.json`. In the absence of that file, CI creates a temporary lockfile from current registry resolution. `npm ci` then installs exactly from that generated lockfile for that CI run, but resolution can differ across separate runs. A maintainer must generate and commit `package-lock.json` from the repository root (`npm install --package-lock-only --ignore-scripts --no-audit --no-fund`) and review it before claiming cross-run dependency reproducibility. Once committed, CI skips bootstrap and uses the committed lockfile.

## Local verification
```bash
npm run verify:dependencies
npm run check:source
```

## Safety
This batch does not alter payout logic or enable live transfers. A green static checker does not mean Jest, Prisma, MySQL integration tests or application builds have passed. Preserve test database isolation and complete all runtime release gates before deployment.
