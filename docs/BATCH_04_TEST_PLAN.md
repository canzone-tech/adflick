# BATCH 04 acceptance checklist

## Pairing
- Authenticated Operations Manager creates a screen; response includes a one-time code and expiration.
- Pairing code is not stored in plaintext.
- Valid code pairs exactly one device.
- Expired, consumed, revoked and incorrect codes fail.
- Concurrent attempts using the same code result in only one successful pairing.
- Device secret is never returned after pairing and only its hash is stored.
- Invalid device secrets return 401; suspended and retired screens cannot heartbeat.

## Fleet access
- Anonymous `GET /api/v1/fleet/screens` returns 401.
- Screen Owner cannot register a screen or enqueue commands.
- User cannot view or control a screen from another organization.
- Operations Manager can register and view screens in their own organization.
- Stale online screens are marked offline by fleet list refresh.

## Heartbeat and commands
- Valid heartbeat sets status ONLINE and updates `lastHeartbeatAt`.
- Invalid secret cannot poll commands or report results.
- `SET_VOLUME` rejects missing, non-integer or out-of-range volume.
- Commands expire and cannot be acknowledged after expiration.
- Suspended/retired devices cannot execute API requests.
- Device command creation writes an audit event.

## Build / migration
- `npx prisma validate`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run typecheck:api`
- `npm run typecheck:web`
- Run integration tests against MySQL 8.4.

Do not mark the batch accepted until these checks have been run in a real development environment.
