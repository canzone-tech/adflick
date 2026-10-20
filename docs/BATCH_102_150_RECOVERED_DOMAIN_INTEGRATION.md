# ADFLICK Batches 102–150 — Recovered Domain Integration

## Scope

The supplied Batches 102–150 archives were inspected in isolation before integration. Their source packages are additive starters, not cumulative application snapshots. We preserve source-backed domain policies and acceptance tests without blindly overlaying their Prisma fragments onto the canonical schema.

## Current integration status

- **Batch 102:** canonical playback reconciliation implemented: event persistence, one-use authorization consumption, idempotency race handling, and accepted-playback durable outbox enqueue occur inside one Prisma transaction. A dedicated outbox migration was added without duplicating the canonical `PlaybackEvent` model.
- **Batches 103–113:** recovered pure TypeScript policy/decision modules and Jest acceptance tests are integrated under `apps/api/src/recovered-domain/bNN/`.
- **Batches 114–116:** source inspected; canonical integration is still pending.
- **Batches 117–118:** recovered pure TypeScript fleet-health/player-diagnostics policy modules and Jest acceptance tests are integrated under `apps/api/src/recovered-domain/b117` and `b118`.
- **Batches 119–150:** source is inventoried and inspected; canonical integration remains pending.

Tests are normalized to the repository's Jest runner; no new test framework dependency is introduced. Prisma fragments are retained as source-recovery evidence but are **not** blindly appended. Several fragments conflict with the canonical schema (for example Batch 102 targets `Device`/`Creative` and duplicates `PlaybackEvent`, while the canonical application uses `Screen`/`MediaAsset` and an existing `PlaybackEvent`).

## Recovered batch themes

103 playback qualification/risk; 104 owner eligibility/earnings; 105 payout maker-checker/reconciliation; 106 provider retry/webhook verification; 107 payout recovery; 108 advertiser billing; 109 wallet/ledger; 110 budget monitoring; 111 campaign scheduling/pacing; 112 device health; 113–118 fleet/device diagnostics; 119–126 player release/update/device command governance; 127–140 maintenance/service/governance; 141–145 security/compliance; 146–150 release governance/reliability/final acceptance.

## Explicit blockers

Batches 051–101 do not have their original source archives in the current workspace. Their recovery bundle explicitly says the originals were unavailable and must not be treated as implemented. This remains a release blocker.

The Smart TV/player implementation is also not complete merely because protocol and release-governance source exists. A real Flutter/Dart player and the declared device acceptance matrix still require implementation and test evidence.

Privileged MFA is also not implemented in the canonical codebase; issue #7 tracks this P1 security gate.

## Acceptance position

This is **not a production GO**. Canonical API wiring for the recovered policy modules, remaining batch reconciliation, migration review, end-to-end workflow integration, security execution, player acceptance, backup/restore evidence, and final release sign-off remain mandatory.
