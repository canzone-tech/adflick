# ADFLICK Batches 102–150 — Recovered Domain Integration

## Scope

The supplied Batches 102–150 archives were inspected in isolation before integration. Their source packages are additive starters, not cumulative application snapshots. The implementation below preserves their domain policies and acceptance tests without blindly overlaying their Prisma fragments onto the canonical schema.

## Integration rule

- Batches 103–150: pure TypeScript domain policy/decision modules and their acceptance tests are intended for integration under `apps/api/src/recovered-domain/bNN/`.
- Tests are normalized to the repository's Jest runner; no new test framework dependency is introduced.
- Relative cross-batch dependency in Batch 120 is explicitly reconciled to the recovered Batch 119 player-update types.
- Prisma fragments are retained as source-recovery evidence but are **not** blindly appended. Several fragments conflict with the canonical schema (for example Batch 102 targets `Device`/`Creative` and duplicates `PlaybackEvent`, while the canonical application uses `Screen`/`MediaAsset` and an existing `PlaybackEvent`).
- Batch 102 is therefore being handled as focused canonical playback reconciliation rather than unsafe schema overlay. The current implementation now makes event persistence, one-use authorization consumption, and accepted-playback outbox enqueue occur in one Prisma transaction; the migration adds the durable outbox table.

## Recovered batch themes

103 playback qualification/risk; 104 owner eligibility/earnings; 105 payout maker-checker/reconciliation; 106 provider retry/webhook verification; 107 payout recovery; 108 advertiser billing; 109 wallet/ledger; 110 budget monitoring; 111 campaign scheduling/pacing; 112 device health; 113–118 fleet/device diagnostics; 119–126 player release/update/device command governance; 127–140 maintenance/service/governance; 141–145 security/compliance; 146–150 release governance/reliability/final acceptance.

## Explicit blockers

Batches 051–101 do not have their original source archives in the current workspace. Their recovery bundle explicitly says the originals were unavailable and must not be treated as implemented. This remains a release blocker.

The Smart TV/player implementation is also not complete merely because protocol and release-governance source exists. A real Flutter/Dart player and the declared device acceptance matrix still require implementation and test evidence.

## Acceptance position

This is **not a production GO**. Canonical Prisma/API wiring for the recovered batch domain policies, migration review, end-to-end workflow integration, security execution, player acceptance, backup/restore evidence, and final release sign-off remain mandatory.
