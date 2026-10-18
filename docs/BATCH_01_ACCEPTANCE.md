# BATCH 01 Acceptance & Smoke Test

## Acceptance criteria
- [ ] `docker compose up -d mysql redis` starts MySQL 8.4 and Redis.
- [ ] `npm install` resolves workspace dependencies without errors.
- [ ] `npm run db:generate` generates Prisma Client.
- [ ] `npm run db:migrate` creates the schema on a clean development database.
- [ ] `npm run db:seed` inserts the development organization, nine role assignments, demo screen and draft campaign.
- [ ] `npm run dev:api` starts the API on port 4000.
- [ ] `GET /api/v1/health` returns API status and database availability.
- [ ] `npm run dev:web` starts the responsive web portal at port 3000.
- [ ] `npm run build:api` and `npm run build:web` complete.
- [ ] Confirm the app does not expose secrets or permit unauthenticated production use.

## Known batch limitations
- No password hashes or login endpoints are present.
- No RBAC guards or organization-scoped authorization are present.
- No file upload endpoint or player/device protocol is present.
- Demo data is not proof of play and does not create payable earnings.
- This scaffold has not been executed against a live MySQL instance in this generated package; run the checklist and fix any environment-specific issues before marking BATCH 01 accepted.
