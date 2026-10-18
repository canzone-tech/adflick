# Batch 26 — Authorization & Tenant-Boundary Regression Tests

## Delivered
- `apps/api/src/auth/guards/roles.guard.spec.ts` tests role allow/deny behavior, missing authenticated user behavior, handler/controller metadata lookup, and the guard's no-role-metadata behavior.
- `apps/api/src/auth/tenant-scope.spec.ts` tests mandatory organization context, tenant predicate composition, rejection of conflicting caller-supplied organization IDs, and non-disclosing cross-tenant errors.
- `docs/BATCH_26_AUTHORIZATION_TEST_EXECUTION.md` records how to execute the suite and what is still needed for database-backed acceptance.
- `scripts/check-batch26.mjs` adds deterministic source checks and is included in `npm run check:source`.

## Execute
Run from the repository root in a provisioned development/CI environment:
```bash
npm ci
npx prisma generate
npm run test:api -- --runInBand
npm run check:source
```

The CI workflow already provisions MySQL 8.4 and applies Prisma migrations. However, these newly added tests are unit-level guard/helper tests; they do not by themselves prove the database-level behavior of all 58 controller routes.

## Required follow-on integration cases
A dedicated MySQL-backed HTTP integration suite must seed two organizations and test cross-tenant list/detail/update/export/nested-resource paths, persisted before/after state, duplicate playback events under concurrency, and concurrent payout decisions. Provider callback tests must validate signature verification on the exact raw request bytes and enforce event idempotency in the database. Tests must run against disposable MySQL 8.4, never production.

## Finance safety
- Reward amounts (including the illustrative ₹1,000 TV / ₹333 smartphone monthly amounts) remain conditional on the configured eligibility policy and review.
- Device playback events alone are not proof of genuine delivery and must not automatically authorize billing or payment.
- Keep live transfers disabled until the release gate is enforced in the transfer execution path and all technical, provider, reconciliation, finance, and security checks have passed.
