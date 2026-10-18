# BATCH 11 acceptance and regression test plan

## Build and schema
- `npm install`
- `npx prisma validate`
- `npm run db:generate`
- `npm run typecheck:api`
- `npm run typecheck:web`
- `npm run build:api`
- `npm run build:web`
- Apply all pending migrations against disposable MySQL 8.4 and run API tests.

## Login and session refresh
- Invalid credentials show an error and do not store tokens.
- Valid credentials store both tokens and route to `/health`.
- A 401 triggers a single refresh-token rotation and retries the request once.
- Expired/invalid refresh token clears stored tokens.
- API offline state produces an actionable connection message without fabricated sample data.
- Verify production cookie-based session migration before broad deployment.

## Health dashboard
- With valid role/context, screens and summary are loaded from API.
- Offline, online, maintenance and unhealthy filters work.
- Refresh button re-fetches both endpoints.
- Refresh playlist and reload player create actual command records for allowed roles.
- Read-only or unauthorized roles see a clear API error and cannot bypass server authorization.
- Empty fleet and missing credentials display explicit empty/connection states.

## Incident dashboard
- List and summary load from API; status/severity filters operate on returned records.
- Scan calls authorized endpoint and refreshes the queue.
- Acknowledge and start investigation persist state.
- Resolve requires a non-empty resolution note.
- Unauthorized actions show server errors; no local-only status mutation is presented as successful.
- Test mobile layout and loading/empty/error states.

## Scheduled alert scan
- Enable scheduler on one API replica and verify scan cadence.
- `ALERT_SCAN_ENABLED=false` disables only alert scanning.
- Test stale heartbeat, OFFLINE screen, player error, 95% resources and 99% resources.
- Repeated scan suppresses duplicate active incidents but creates a new one after prior incident is resolved.
- Organization without active operational user logs a warning and does not create invalid incidents.
- Validate behavior for >5,000 screens and optimize paging before production scale.
- Confirm no email/SMS/webhook delivery is implied or claimed.

## Optional webhook adapter
- With `ALERT_WEBHOOK_URL` unset, incident creation succeeds and webhook remains disabled.
- Non-HTTPS URL is rejected by the notifier.
- Configured HTTPS endpoint receives `adflick.incident.created` payload.
- HTTP errors and timeouts are logged without rolling back incident creation.
- Ensure bearer token and URL are never returned in API responses or browser code.
- Confirm no email/SMS/WhatsApp/push delivery is claimed.
