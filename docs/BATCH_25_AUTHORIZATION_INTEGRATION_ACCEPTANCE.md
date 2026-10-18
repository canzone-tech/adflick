# Batch 25 — Authorization Integration Test Readiness & Security Acceptance

## Objective
Turn the Batch 21–24 tenant-isolation work into a release acceptance contract. This batch adds a role-permission acceptance matrix, prioritized security scenarios, and a deterministic source-level guardrail check. It does **not** claim that runtime integration tests have passed.

## Required automated suites
1. **HTTP authorization suite:** run a real NestJS test application and assert 401 for missing authentication, 403 for disallowed roles, and no response body leakage.
2. **Two-tenant MySQL 8.4 suite:** seed Organization A and B, then test list/detail/update/delete/nested-resource/export paths using IDs owned by the other organization. Assert both response and persisted state.
3. **Device/playback suite:** test invalid device secrets, duplicate event IDs under concurrency, timestamp bounds, campaign association, and event quarantine. Device-secret authentication is not equivalent to cryptographic proof that a playback occurred.
4. **Finance/payout suite:** test maker-checker, concurrent conditional state transitions, reward thresholds, callback replay, statement mismatches, and fail-closed release blockers.
5. **Security regression suite:** test upload/URL fetch SSRF defenses, secret redaction, rate limits, and audit logging. SSRF and multi-replica scheduler concerns remain explicit release blockers until remediated and tested.

## Release acceptance rules
- CI must use a disposable MySQL 8.4 service and apply all Prisma migrations before integration tests.
- Unit tests alone do not satisfy tenant isolation acceptance; integration tests must verify persisted rows before and after denied mutations.
- All nine roles must be exercised against positive and negative permission cases. The CSV is a target acceptance contract, not proof of implementation.
- No payout or reward is automatically paid solely because a player reports a completed playback event.
- **Live transfers stay disabled** until the release gate is enforced in the actual transfer execution path, provider integration and webhook tests pass, finance and security sign-off is recorded, and reconciliation has no unexplained discrepancies.
- A green source scanner does not replace `prisma validate`, TypeScript builds, Jest, or MySQL-backed tests.

## Execution commands
From the repository root:
```bash
npm ci
npm run check:source
npm run verify:release
```
`verify:release` is expected to require configured environment variables and a provisioned database/provider sandbox. Do not run it against production.

## Batch 25 delivered
- `BATCH_25_ROLE_PERMISSION_ACCEPTANCE_MATRIX.csv`
- `BATCH_25_SECURITY_ACCEPTANCE_TEST_MATRIX.csv`
- `scripts/check-batch25.mjs`
- Cumulative source-check chain updated to include Batch 25.
- `BATCH_25_FILE_MANIFEST.txt` contains SHA-256 digests for all project files except the manifest itself.

## Known limits
This batch establishes test scope and static guardrails; it does not add a fully provisioned end-to-end test database or claim all 9 roles have passed integration tests. Review the matrix against the product's approved authorization policy before launch.
