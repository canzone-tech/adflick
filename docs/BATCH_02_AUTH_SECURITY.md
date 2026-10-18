# BATCH 02 — Authentication, sessions and role access

## Implemented in source
- Argon2id password hashing for development seed and password changes
- Login with a generic invalid-credentials response
- Short-lived HS256 access JWTs (default 15 minutes)
- Opaque refresh tokens; only SHA-256 token hashes are stored
- Atomic refresh-token rotation and session revocation
- Active-account checks on login and authenticated requests
- `/api/v1/auth/me`, `/login`, `/refresh`, `/logout`, `/change-password`
- Role metadata decorator and guard with a sample admin-only route
- Security headers via Helmet
- Audit events for successful login, logout and password changes
- DTO validation with whitelist/forbidNonWhitelisted enabled globally

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Verify email/password and issue tokens |
| POST | `/api/v1/auth/refresh` | Refresh token | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Bearer access token | Revoke current session; optionally revoke supplied refresh token |
| GET | `/api/v1/auth/me` | Bearer access token | Return current user and roles |
| POST | `/api/v1/auth/change-password` | Bearer access token | Change password and revoke all refresh sessions |
| GET | `/api/v1/access/admin-check` | Admin roles | Example role-protected route |

## Development demo credentials
The seed script sets all nine demo accounts to `DEMO_SEED_PASSWORD` (default in `.env.example` is intentionally a placeholder). Set a known local-only value before running the seed. These are test accounts only; never deploy them or use the shared prototype password in production.

## Required configuration
- `JWT_ACCESS_SECRET`: at least 32 characters; use a unique, cryptographically random value.
- `JWT_REFRESH_SECRET`: reserved for a future signed-token design; refresh tokens here are random opaque tokens hashed with SHA-256.
- `ACCESS_TOKEN_TTL_SECONDS`: default 900.
- `REFRESH_TOKEN_TTL_DAYS`: default 14.
- `DEMO_SEED_PASSWORD`: development only.

## Important security notes
1. Browser clients should store refresh tokens in Secure, HttpOnly, SameSite cookies in production. This initial API returns the refresh token in JSON for cross-platform API testing; do not persist it in localStorage in a production browser app.
2. Add IP/account rate limiting and alerting before internet exposure. A reverse proxy should enforce TLS and request-size limits.
3. MFA enrollment and enforcement for privileged roles is not yet implemented. Do not mark security compliance complete until MFA, recovery, lockout/rate limits and session-management tests pass.
4. Role guard is a route-level baseline, not complete resource-level authorization. Each data query must scope records to the user's organization and role; Super Admin bypasses must be explicit and audited.
5. A JWT session is checked against the database on each request. This enables session revocation but adds a DB lookup; evaluate cache strategy only after security review.
6. No public signup or password-reset route is included. Accounts are provisioned by controlled admin workflows in a later batch.

## Example local API requests

Login (replace the password with your configured `DEMO_SEED_PASSWORD`):

```bash
curl -sS -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@adflick.demo","password":"YOUR_LOCAL_DEMO_PASSWORD"}'
```

Use the returned access token:

```bash
curl -sS http://localhost:4000/api/v1/auth/me \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Admin role check:

```bash
curl -i http://localhost:4000/api/v1/access/admin-check \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```
