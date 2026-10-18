# Batch 18 Test Plan

- `npm run check:source` and `node scripts/check-batch18.mjs` must pass.
- Run provider-safety Jest tests for valid HMAC, bad/missing signature, stable payload digest, quoted CSV fields, duplicate rows, invalid integer paise and malformed CSV.
- Add controller-level tests once a specific payment provider and raw-body handling strategy are selected.
- Validate Prisma schema and generate client; deploy migration to disposable MySQL 8.4; verify unique duplicate webhook event rejection.
- Test event persistence + business-state transition transactionally; retry worker must not duplicate ledger effects.
- Test provider timeout, repeated callback, out-of-order callback, signed callback with stale timestamp, and statement amount mismatch.
- Production gate: transfers disabled until all above pass in provider sandbox and finance/compliance approve.
