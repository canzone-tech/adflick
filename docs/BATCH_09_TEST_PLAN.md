# BATCH 09 acceptance and regression test plan

## Heartbeat / health
- Correct device secret updates last heartbeat and last seen.
- Invalid or missing secret is rejected.
- Heartbeat updates resource metrics and player error fields.
- Heartbeat never changes MAINTENANCE to ONLINE.
- `syncStatus=SYNCED` updates lastSyncAt; missing status does not erase prior sync time.
- Health summary is organization scoped and enforces role restrictions.
- A screen is counted unhealthy when a player error exists or resource telemetry reaches 95%.
- Retired screens are excluded from total fleet health count.

## Command retry behavior
- Expired pending commands become EXPIRED and are not returned.
- First poll delivers a pending command and increments delivery count.
- Poll within 30 seconds does not redeliver the same command.
- Poll after 30 seconds may redeliver it with the same ID.
- Delivery count never exceeds 10.
- Pending command at retry limit becomes FAILED.
- Player-reported failure persists a bounded error message.
- Cross-screen command result submission is rejected.
- Command result submission after expiry or terminal state is rejected.
- Player idempotency prevents repeating side effects when a command is redelivered.

## Offline/reconnect protocol
- Existing playlist continues while network is unavailable if cached and allowed by policy.
- Partial/corrupt downloads never replace known-good cached assets.
- Cache eviction does not remove assets referenced by active offline playlist.
- Reconnect fetches current manifest, reconciles assets, flushes queued telemetry and processes pending commands.
- Event IDs remain stable across retries and duplicates are not counted twice.
- Expired playback authorization is not treated as eligible for financial calculations.

## Database/build
- `npx prisma validate`
- `npm run db:generate`
- Apply migration against disposable MySQL 8.4.
- API/web build, typecheck, lint and integration tests.
- Verify retry behavior with concurrent command polling.
- Verify health metrics with null, boundary and 100% values.
- Verify migration rollback plan and production backup before deployment.
