# BATCH 02 — Authentication test plan

## Manual smoke tests
1. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`.
2. POST `/api/v1/auth/login` with an active seeded account and configured development password; expect access and refresh tokens.
3. Repeat with a wrong password; expect 401 and generic `Invalid email or password.`
4. Call `/api/v1/auth/me` without bearer token; expect 401.
5. Call `/api/v1/auth/me` with valid access token; expect current user and role list.
6. Call `/api/v1/access/admin-check` as Super Admin or Organization Admin; expect 200.
7. Call the same route as Screen Owner; expect 403.
8. Refresh once; expect new access/refresh tokens. Reuse old refresh token; expect 401.
9. Change password with correct current password and a 12+ character new password; expect session revocation.
10. Confirm an account marked SUSPENDED cannot login and existing access tokens fail.

## Security test backlog
- Login/refresh rate limits and IP-based abuse controls
- Concurrent refresh race and replay detection behavior
- MFA enrollment, recovery codes and mandatory MFA for privileged roles
- Browser Secure/HttpOnly/SameSite cookie flow + CSRF controls
- Tenant isolation tests for every resource endpoint
- Session listing/revocation UI and admin-forced logout
- Password reset flow with single-use expiring tokens
- Secrets manager integration and key rotation
- Dependency audit and penetration test
