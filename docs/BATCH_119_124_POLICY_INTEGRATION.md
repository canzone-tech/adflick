# Batches 119–124 policy integration

## Scope
This slice ports source-backed player release/update governance and device trust/command authorization policies into the repository's Jest test environment. It does not claim production service, Prisma, queue, cryptographic verification, or device-player integration.

- B119: release eligibility, deterministic cohort bucketing, rollout/update state transitions, rollout health pause gate.
- B120: rollout health analytics, independent maker-checker, rollback readiness.
- B121: post-update restart/version/health verification and bounded exponential retry.
- B122: release digest/trust policy and signing-key rotation readiness.
- B123: enrollment challenge checks and credential rotation state transitions.
- B124: high-risk command classification and tenant/role/device/credential/TTL authorization.

## Security boundary
These are pure policy helpers. Production must load authorization inputs from trusted persisted records, verify signatures/proof-of-possession with vetted cryptography, atomically consume enrollment challenges, and enforce command authorization both at enqueue and immediately before execution. Client-supplied booleans are not evidence. Hash bucketing is deterministic rollout allocation, not a security primitive.

## Remaining integration work
Canonical Prisma/API/controller/queue wiring, DB race tests, real signature and proof-of-possession verification, key storage/rotation operations, player runtime integration, and device-matrix UAT remain pending. Prisma fragments from recovered archives are not blindly merged into the canonical schema.

## Validation
Jest acceptance tests cover key allow/deny paths and invalid transitions. CI must pass all three workflows on the same exact commit SHA before release evidence is current. Production remains NO-GO.
