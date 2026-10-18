# BATCH 12 security and integration acceptance plan

## Commands
```bash
npm install
npm run typecheck:api
npm run typecheck:web
npm run build:api
npm run build:web
npm run test:api
npx prisma validate
npm run db:generate
```
Apply pending migrations to a disposable MySQL 8.4 instance before acceptance.

## CORS
- Exact configured origin accepted.
- Unlisted browser origin rejected.
- Multiple comma-separated origins accepted only when exact match.
- No wildcard origin when credentials are enabled.
- Requests with no Origin header remain supported for player/server clients.

## Authentication and rate limits
- Invalid login never returns token values.
- Login throttling is applied at 5/minute and refresh at 10/minute per configured throttler identity.
- Expired refresh token fails closed.
- Concurrent refresh requests cannot both rotate the same refresh token.
- Production migration plan for HttpOnly cookies and CSRF protection is reviewed.

## Webhook
- Missing endpoint returns `WEBHOOK_NOT_CONFIGURED`.
- HTTP endpoint is refused.
- HTTPS endpoint with credentials or fragment is refused.
- Host outside `ALERT_WEBHOOK_ALLOWED_HOSTS` is refused.
- Redirect responses are not followed.
- Successful 2xx response is reported as delivered.
- 4xx/5xx/timeout returns a failure reason and does not roll back incident creation.
- Secrets never appear in webhook payload or browser bundle.

## Incident lifecycle and tenant isolation
- RESOLVED and DISMISSED incidents cannot be changed.
- Cross-organization IDs cannot be read or updated.
- Active alert duplicates are suppressed for same screen/category.
- Resolution requires a note.
- Role matrix is checked at controller and service layer.

## Regression and deployment
- Run unit tests, API/web typechecks and production builds.
- Apply all pending migrations against MySQL 8.4.
- Verify health, fleet, playback, delivery, scheduler and incident routes.
- Run with one API replica until distributed scheduler locking is implemented.
- Validate proxy, CORS, secrets, backup/restore and monitoring configuration.
