# BATCH 05 acceptance test plan

## Device authentication and idempotency
- Missing or invalid `x-device-secret` returns an authentication error.
- Suspended and retired devices cannot submit playback events.
- Repeated `screenId + eventId` does not create a second database row.
- Concurrent duplicate requests produce at most one row.
- Batch size 0 and batch size >100 are rejected.

## Validation
- Asset not READY or in another organization is rejected.
- Campaign from another organization or in an invalid state is rejected.
- Campaign start/end boundary violations are rejected.
- Asset absent from the supplied active playlist is rejected.
- Completion without timestamps/duration is rejected.
- Completion timestamp before start is rejected.
- Completion without a server-known expected duration is rejected.
- Client-reported expected duration that differs from server-known duration is rejected.
- Completion shorter than 90% of expected duration is rejected.
- Duration/timestamp mismatch is rejected.
- Event older than the accepted window or implausibly in the future is rejected.
- Valid completed play creates ACCEPTED row.
- PLAY_STARTED, PLAY_INTERRUPTED and PLAY_ERROR are stored distinctly and do not count as completed plays.

## Reporting
- Anonymous report request returns 401.
- Screen Owner, Advertiser and Support Agent cannot access aggregate report endpoint.
- Organization user sees only their own organization records.
- `acceptedCompletedPlays` counts only ACCEPTED PLAY_COMPLETED events.
- Optional `screenId` filter is applied.

## Build / migration
- `npx prisma validate`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run build` for API and web
- MySQL 8.4 integration tests, duplicate-race tests and security tests
- Inspect query plans for event reports at expected production scale

Do not mark BATCH 05 accepted until checks pass in a real development environment.
