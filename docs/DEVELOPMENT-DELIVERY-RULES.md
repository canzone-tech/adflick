# Delivery and verification rules

- Approved branch: `dev/local-foundation`. Source recovery baseline: `development` at `799d689`. Default `main` is not the working branch.
- Import batches only after isolate, SHA-256 inventory, code review, dependency/migration diff, and regression coverage.
- Development gates: `npm run verify` (clean install, source checks, environment, Prisma, migrations to disposable local MySQL, lint/typecheck, unit, integration, production builds, compiled startup, HTTP smoke).
- CI: separate Backend CI, Frontend CI, exact-SHA Release Evidence. Keep CI/local parity. CI failures are blockers, not passed exceptions.
- Never replay or edit an applied migration; confirm external usage before resolving historical checksum conflicts.
- Finance: MySQL authoritative, approved versioned policy only, maker-checker, ledger + reconciliation, no live payouts without explicit independent approval.
- Production: separate approval of exact immutable source-free release artifact, off-host encrypted backup and isolated restore, rollback, smoke and operator sign-off.
- Handoff after three exact-SHA green CI checks: `git pull` then `npm run verify`; user confirms local result.
