# Batch 50 — Clean Release Preflight

## Purpose

Provide a deterministic preflight for a clean checkout before dependency installation and release testing. This is a guardrail, not evidence that tests or builds have passed.

## Commands

```bash
npm run check:source
npm run verify:clean-release
npm ci --no-audit --no-fund
npx prisma validate
npm run typecheck:api
npm run typecheck:web
npm run lint
npm run test:api
npm run test:e2e:security
npm run test:e2e:finance
npm run build:api
npm run build:web
```

Run MySQL 8.4 integration tests only against a disposable, explicitly configured test database. Never point test suites at production data.

## Lockfile requirement

The root `package-lock.json` is not present in this source bundle. The preflight therefore intentionally fails closed. From an environment with npm registry access, generate a lockfile using the project's reviewed Node.js/npm toolchain, inspect the dependency diff, run `npm ci` from a clean checkout, and commit the lockfile. Do not treat an automatically generated, unreviewed lockfile as release evidence.

## Release evidence

Capture CI job URLs or logs, Node/npm versions, `npm ci` result, Prisma validation output, migration output, unit/E2E reports, type-check results, lint results and production build results. Record failed tests and fixes; do not replace failures with static-check results.

## Financial safety boundary

Reconciliation is not payout authorization. Keep transfers disabled until runtime testing, security review, finance maker-checker approval and payment-provider release gates have passed.
