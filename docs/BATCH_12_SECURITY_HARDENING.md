# BATCH 12 — Production Security & Reliability Hardening

## Changes
- API CORS parses comma-separated `WEB_ORIGIN` values and allows only exact configured origins. Requests without an Origin header remain supported for non-browser clients; browser credentials remain enabled.
- Browser operator authentication now uses Secure/HttpOnly access and refresh cookies instead of browser local storage. Production uses `__Host-` cookie names; local development keeps host-only cookies without Secure so localhost HTTP works.
- Login and refresh responses no longer expose bearer or refresh tokens to browser JavaScript. Bearer extraction remains supported for approved non-browser API clients.
- State-changing browser requests are protected by an exact Origin/Referer boundary in addition to SameSite cookies. Untrusted cross-origin POST/PUT/PATCH/DELETE requests return HTTP 403.
- Login is limited to 5 attempts per minute per throttler identity; refresh is limited to 10 per minute. Validate proxy/IP behavior before relying on these limits behind a reverse proxy.
- Webhook integration requires HTTPS, rejects URL userinfo/fragments, requires the exact hostname in `ALERT_WEBHOOK_ALLOWED_HOSTS`, and refuses redirects to prevent allowlist bypass through redirect targets.
- Incident records in RESOLVED or DISMISSED state are read-only; recurrence should create a new incident.
- Added unit tests for webhook disabled, HTTPS enforcement, hostname allowlisting, successful delivery, and failed HTTP responses.
- Added Jest config for API unit tests.

## Required production work not completed in this batch
- Configure `AUTH_COOKIE_SECURE=true` and an exact production `WEB_ORIGIN`. Keep `AUTH_COOKIE_SAME_SITE=lax` unless the approved deployment topology requires `none` and HTTPS.
- No durable transactional notification outbox, retry queue, delivery ledger or per-organization webhook configuration.
- Hostname allowlisting is a baseline guard, not a complete network egress firewall. Use deployment-level egress policy and dedicated webhook hosts; do not allow private/internal hosts.
- Rate limits are process-local unless a shared throttler storage backend is configured; behind proxies, configure trusted proxy handling safely.
- The scheduler still requires a single API replica until distributed leader election/locking exists.
- Device-reported telemetry and playback events are not tamper-proof.

## Environment
- `WEB_ORIGIN=http://localhost:3000` (comma-separated exact origins allowed)
- `AUTH_COOKIE_SECURE=false` for local HTTP; set `true` for production HTTPS
- `AUTH_COOKIE_SAME_SITE=lax` by default; `none` requires `AUTH_COOKIE_SECURE=true`
- `ALERT_WEBHOOK_URL=` (optional HTTPS endpoint)
- `ALERT_WEBHOOK_ALLOWED_HOSTS=hooks.example.com` (exact hostname allowlist)
- `ALERT_WEBHOOK_BEARER_TOKEN=` (optional secret; keep server-side)

## Manual verification
1. Sign in from the approved web origin and verify the account page works after a hard refresh.
2. Verify browser storage contains no ADFLICK access or refresh token.
3. Verify an untrusted Origin on a state-changing API request returns 403 and does not mutate state.
4. Verify login/refresh throttling returns 429 when the configured threshold is exceeded.
5. Test a webhook URL with HTTP, URL credentials, fragment, unlisted hostname and a redirect response.
6. Verify webhook errors never roll back the incident record.
7. Verify RESOLVED/DISMISSED incidents cannot be modified.
8. Run API unit tests and all build/type/schema checks listed in `docs/BATCH_12_TEST_PLAN.md`.
