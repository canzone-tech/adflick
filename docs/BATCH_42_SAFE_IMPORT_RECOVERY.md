# Batch 42 — Safe Reconciliation Import Recovery

## Scope

Batch 42 extends Batch 41's transactional statement importer with database-backed worker claims and bounded recovery after a process crash. It does not settle payout items, create ledger entries, call a payment provider, or transfer money.

## Concurrency and recovery

- Each processing attempt gets a random UUID claim token and a five-minute lease.
- A conditional `updateMany` claims only a `RECEIVED` import or a `PROCESSING` import whose lease has expired. The affected-row count is the claim arbiter.
- The unique organization/provider/idempotency key and SHA-256 payload comparison remain the request deduplication boundary.
- A repeated request with the same payload can recover a `RECEIVED` reservation or a `PROCESSING` record with a missing/expired lease (including legacy records). A live lease returns `IN_PROGRESS`; a changed payload under the same key remains a conflict.
- The final row inserts and completion transition occur in one transaction. Completion must match organization, import ID, `PROCESSING` status and the current claim token. If the claim was replaced, the transaction throws and rolls back row inserts.
- Error cleanup is token-fenced, so a worker whose lease was replaced cannot mark the newer worker's import failed.
- `attemptCount` provides a basic operational signal for repeated recoveries. Alerting and automatic lease extension are not included.

## Safety boundaries

- Payout queries remain scoped by `organizationId`.
- The CSV's payout reference is treated as a payout-item ID, not as proof of provider settlement.
- Reconciliation outcomes are persisted for finance review only. They do not mutate payout-item status or trigger a payout.
- Five minutes is a starting lease. Production must load-test large statements and consider lease renewal before accepting files that can take longer to process. Since the uploaded payload is supplied again for recovery and hash-checked, the raw statement is not persisted by this batch.

## Migration and checks

Apply `prisma/migrations/202610140042_reconciliation_import_leases/migration.sql` after Batch 41's row persistence migration. Run `npm run check:source`. Prisma validation, Jest, MySQL concurrency tests, and full build still require installed dependencies and a configured MySQL 8.4 test database; static checks are not substitutes for those runtime checks.
