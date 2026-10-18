# BATCH 08 acceptance and regression test plan

## Scheduler
- `SCHEDULER_ENABLED=false` prevents the in-process scheduler from starting.
- Future SCHEDULED campaign remains SCHEDULED.
- Scheduled campaign within start/end window becomes ACTIVE.
- ACTIVE, PAUSED or SCHEDULED campaign past its end becomes COMPLETED.
- Scheduled campaign with past start and null end becomes ACTIVE.
- Run cycle repeatedly and confirm duplicate refresh commands are throttled within five minutes.
- Run only one API replica until distributed scheduler locking is implemented.

## Playlist assignments
- Missing organization context is rejected.
- Cross-organization screen or playlist cannot be assigned.
- DRAFT/ARCHIVED playlist cannot be assigned.
- RETIRED screen cannot be assigned.
- Invalid start/end window is rejected.
- Repeating same screen/playlist assignment updates rather than duplicates it.
- Disable only affects assignment matching organization, screen and assignment ID.
- Read/write role matrices are enforced.
- Assignment change enqueues a REFRESH_PLAYLIST command.

## Manifest and player
- Manifest includes only ACTIVE playlists assigned to the requested screen and in their assignment time window.
- Cross-organization playlist assets are excluded.
- Non-READY assets or assets without storage keys are excluded.
- Each playlist item returns playlist ID, order, signed media URL and authorization token.
- Playback event must provide matching `playlistId`, authorization ID and token.
- Token for another screen, asset or playlist is rejected.
- Terminal event consumes token; subsequent terminal reuse is rejected.
- Existing campaign creative delivery and organization/screen targeting continue to work.
- Test offline device command polling and reconnect recovery.

## Database/build
- `npx prisma validate`
- `npm run db:generate`
- Apply migration against a disposable MySQL 8.4 database.
- Run API/web build, typecheck, lint and integration tests.
- Verify MySQL indexes, constraints and rollback plan.
