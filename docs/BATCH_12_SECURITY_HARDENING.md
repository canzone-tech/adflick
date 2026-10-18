# BATCH 12 — Production Security & Reliability Hardening

## Changes
- API CORS now parses comma-separated `WEB_ORIGIN` values and allows only exact configured origins. Requests without an Origin header remain supported for non-browser clients; browser credentials remain enabled.
- Login is limited to 5 attempts per minute per throttler identity; refresh is limited to 10 per minute. Validate proxy/IP behavior before relying on these limits behind a reverse proxy.
- Webhook integration requires HTTPS, rejects URL userinfo/fragments, requires the exact hostname in `ALERT_WEBHOOK_ALLOWED_HOSTS`, and refuses redirects to prevent allowlist bypass through redirect targets.
- Incident records in RESOLVED or DISMISSED state are read-only; recurrence should create a new incident.
- Added unit tests for webhook disabled, HTTPS enforcement, hostname allowlisting, successful delivery, and failed HTTP responses.
- Added Jest config for API unit tests.

## Required production work not completed in this batch
- Browser auth still stores bearer and refresh tokens in local storage. Migrate to secure HttpOnly cookies with CSRF protection before production.
- No durable transactional notification outbox, retry queue, delivery ledger or per-organization webhook configuration.
- Hostname allowlisting is a baseline guard, not a complete network egress firewall. Use deployment-level egress policy and dedicated webhook hosts; do not allow private/internal hosts.
- Configure `WEB_ORIGIN` to the exact deployed origin(s); do not use wildcard origins with credentials.
- Rate limits are process-local unless a shared throttler storage backend is configured; behind proxies, configure trusted proxy handling safely.
- The scheduler still requires a single API replica until distributed leader election/locking exists.
- Device-reported telemetry and playback events are not tamper-proof.
- No dependency installation, TypeScript compilation, Prisma validation, MySQL migration or end-to-end test was completed in this environment.

## Environment
- `WEB_ORIGIN=http://localhost:3000` (comma-separated exact origins allowed)
- `ALERT_WEBHOOK_URL=` (optional HTTPS endpoint)
- `ALERT_WEBHOOK_ALLOWED_HOSTS=hooks.example.com` (exact hostname allowlist)
- `ALERT_WEBHOOK_BEARER_TOKEN=` (optional secret; keep server-side)

## Manual verification
1. Use a browser from an unlisted origin and confirm API requests are not CORS-authorized.
2. Verify login/refresh throttling returns 429 when the configured threshold is exceeded.
3. Test a webhook URL with HTTP, URL credentials, fragment, unlisted hostname and a redirect response.
4. Verify webhook errors never roll back the incident record.
5. Verify RESOLVED/DISMISSED incidents cannot be modified.
6. Run API unit tests and all build/type/schema checks listed in `docs/BATCH_12_TEST_PLAN.md`.
