# Batch 49 — Fail-Closed CI and Dependency Reproducibility

## Purpose
Batch 48 still allowed CI to generate a temporary lockfile when the repository root had no `package-lock.json`. That made a single CI run internally consistent but did not pin dependency resolution between runs. Batch 49 removes that fallback and makes the missing lockfile an explicit release-blocking condition.

## CI policy
- CI must use Node.js 22 and npm 10 or newer, matching the root `engines` declaration.
- A committed root `package-lock.json` is mandatory.
- CI runs `npm ci --no-audit --no-fund`; it must not generate a lockfile dynamically.
- The dependency verifier checks workspace manifests and lockfile version 3 metadata.
- Static source checks run before the remaining release verification stages.

## Maintainer action required
This source bundle intentionally does not fabricate a lockfile. In an environment with registry access, from the repository root:

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --no-audit --no-fund
npm run verify:dependencies
npm run check:source
```

Review and commit `package-lock.json` after the clean install. Then run Prisma validation, migrations against a disposable MySQL 8.4 database, unit and E2E tests, type checks, lint and production builds. Do not treat lockfile generation alone as test certification.

## Release safety
No payout behavior is changed by this batch. Live transfers remain disabled until runtime tests, security review, finance approval and provider release checks are complete.
