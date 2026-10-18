# Batch 47 — Reconciliation Release Gate

## Purpose
Provide one explicit, repeatable command for the reconciliation checks added through Batch 46. This batch adds orchestration and safeguards; it does not claim that the runtime tests have already executed.

## Command

```bash
npm run verify:reconciliation:release
```

The gate runs cumulative static checks, Prisma schema validation and the focused reconciliation unit tests. MySQL integration and HTTP end-to-end suites are opt-in because they create test organizations, users, sessions and reconciliation rows.

To opt in, use a **disposable local MySQL 8.4 test database** and set:

```bash
export DATABASE_URL='mysql://USER:PASSWORD@127.0.0.1:3306/adflick_test'
export JWT_ACCESS_SECRET='replace-with-a-random-secret-at-least-32-characters'
export RUN_MYSQL_FINANCE_E2E=1
npm run verify:reconciliation:release
```

Use credentials for a dedicated disposable database only. The gate refuses non-local database hosts when the opt-in integration tests are enabled. Apply the project's migrations to the test database before running. Do not point this suite at production or any database containing real customer/financial data.

## Dependency reproducibility
The repository must have installed dependencies before running the gate. At the time of authoring, no root `package-lock.json` is included, so `npm ci` cannot be used reproducibly until a lockfile is generated and committed by maintainers. The gate intentionally does not install packages or modify the lockfile automatically.

## Expected coverage
- Cumulative static checks for all implemented batches.
- Prisma schema validation.
- Reconciliation processing, idempotency, observability and read-service unit tests.
- Optional MySQL concurrency, lease recovery, transaction rollback and authenticated HTTP tests.
- Organization isolation and role authorization covered by the opt-in HTTP suite.

## Safety boundaries
- `RUN_MYSQL_FINANCE_E2E` defaults to disabled.
- MySQL E2E tests are restricted to `localhost` / `127.0.0.1` connection strings.
- Do not treat skipped suites as passing tests.
- Static checks do not establish runtime correctness; runtime tests are not implied by static checks.
- This gate does not settle payout items, call payment providers, or create or enable live payouts.
- Live payouts remain disabled pending test execution, independent security review, finance approval and provider certification.

## Completion evidence
Capture Node/npm versions, commit ID, MySQL 8.4 version, exact command, test counts, skipped suites and exit status in the engineering release record. Do not mark the release gate green if any required suite was skipped or failed.
