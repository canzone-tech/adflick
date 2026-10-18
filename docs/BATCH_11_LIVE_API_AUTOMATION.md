# BATCH 11 — Live API Integration & Automated Operations

## Delivered
1. Added `apps/web/lib/api.ts`, a shared JSON API client with bearer token attachment, 401 refresh-token rotation and typed error messaging.
2. Added `/login`, which calls `POST /api/v1/auth/login`, stores access/refresh tokens and routes successful sign-in to `/health`.
3. Replaced sample-only health data with authenticated live requests to:
   - `GET /api/v1/fleet/screens`
   - `GET /api/v1/fleet/health-summary`
4. Connected health-page recovery buttons to `POST /api/v1/fleet/screens/:id/commands` for `REFRESH_PLAYLIST` and `RELOAD_APP`.
5. Replaced sample-only incident queue with live calls to:
   - `GET /api/v1/incidents`
   - `GET /api/v1/incidents/summary`
   - `POST /api/v1/incidents/scan-alerts`
   - `PATCH /api/v1/incidents/:id`
6. Connected incident workflow actions to the API; resolving an incident prompts for the required resolution note.
7. Added scheduled fleet alert scans to the existing campaign/playlist scheduler. `ALERT_SCAN_ENABLED=false` disables the alert scan independently; it does not disable campaign/playlist scheduling.
8. Automated scans create incidents for stale/offline screens, player errors and resource pressure; active same-screen/same-category incidents suppress duplicates. Creation is audited.
9. Added root `.env.example` settings for `NEXT_PUBLIC_API_BASE_URL`, `ALERT_SCAN_ENABLED`, and scheduler controls.

## Web authentication notes
The login page currently stores access and refresh tokens in browser local storage for this prototype. This is a functional bridge to the existing bearer-token API, not the preferred final production session design. For production, move session handling to secure HttpOnly cookies with appropriate CSRF protections, strict origin policy and token rotation.

The browser API URL is compiled into the Next.js app. Set `NEXT_PUBLIC_API_BASE_URL` before building/deploying the web app.

## Automated scan behavior
- Scans at most 5,000 non-retired/non-suspended screens per scheduler cycle.
- Offline status or stale ONLINE heartbeat (>120 seconds) creates HIGH `SCREEN_OFFLINE`.
- Reported player error creates HIGH `PLAYER_ERROR`.
- CPU, memory or disk at >=95% creates HIGH `RESOURCE_PRESSURE`; >=99% is CRITICAL.
- The first active operational user in each organization is recorded as the system-created incident opener. If an organization has no active Super Admin, Organization Admin or Operations Manager, its automated alert creation is skipped and logged.
- Scheduler runs in-process. Operate one API replica only until distributed leader election/locking is implemented.
- Optional `ALERT_WEBHOOK_URL` sends incident-created events to a configured HTTPS endpoint. If unset, webhook delivery is disabled. Email, SMS, WhatsApp and push adapters are not implemented.

## Known limitations and security requirements
- The browser dashboard expects an access token in `adflick_access_token` and refresh token in `adflick_refresh_token`; `/login` populates both.
- Role restrictions remain enforced by the API. A visible action can still be denied for read-only roles; the UI reports the API error.
- Telemetry is device-reported and can be spoofed.
- Alert duplicate suppression is not a distributed uniqueness guarantee across multiple scheduler replicas.
- Full TypeScript build, Prisma validation, migration execution and end-to-end tests were not run in this environment.

## Optional webhook adapter
- Set `ALERT_WEBHOOK_URL` to an HTTPS endpoint and optionally `ALERT_WEBHOOK_BEARER_TOKEN`.
- The API sends `POST` JSON with event `adflick.incident.created`, `occurredAt`, and incident metadata.
- Adapter timeout is 5 seconds; delivery errors are logged and do not roll back incident creation.
- There is no durable notification outbox/retry queue, delivery history UI, endpoint allowlist, or per-organization webhook configuration. Treat this as an integration adapter foundation, not a guaranteed delivery system. Protect the endpoint and bearer token as server-side secrets.
