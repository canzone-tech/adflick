# Batch 35 — Reconciliation Audit Atomicity and Tenant-Scoped Reads

## Scope

This batch hardens payout reconciliation data access and adds regression coverage for failures while writing the required audit event.

## Changes

- The reconciliation batch lookup now filters nested payout items by the authenticated `organizationId`; it no longer loads every nested item by relation alone.
- Provider-submission transaction's final batch read now uses both batch ID and organization ID.
- Added `payouts.reconcile-transaction.spec.ts` to verify the organization predicate on reconciliation's initial nested item read.
- Added a failure-path unit test: when audit insertion rejects, the service propagates the error and does not return the final success result.

## Transaction guarantees and limitations

The production code runs payout item writes, conditional batch transition, audit insertion, and final read inside one Prisma interactive transaction. A real database transaction should roll back earlier writes if audit insertion fails. The unit test uses a mock transaction callback and therefore **does not prove database rollback**. CI must run the database-backed integration acceptance tests against a disposable MySQL 8.4 database to establish rollback and persisted audit consistency.

## Acceptance matrix

1. Initial reconciliation lookup scopes batch by `id` and `organizationId`.
2. Nested reconciliation items are filtered by `organizationId`.
3. The provider-submission final batch read is organization-scoped.
4. Audit insertion failure propagates; no successful result is returned.
5. MySQL integration test confirms item and batch state rollback after a forced audit insert failure.
6. MySQL integration test confirms exactly one durable reconciliation audit for a successful transaction.
7. No live payout transfer is invoked by reconciliation.

## Validation status

Static source checks and archive integrity checks can be run without external services. Jest execution and MySQL 8.4 integration checks must be reported separately; neither should be claimed passed unless actually executed.
