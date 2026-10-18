# BATCH 03 acceptance test plan

## Setup
1. Configure `.env` and valid local development secrets.
2. Start `mysql`, `redis` and `minio` via Docker Compose.
3. Create the configured media bucket in MinIO.
4. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
5. Start API and web services; authenticate using a seeded local demo account.

## API checks
- Unauthenticated `GET /api/v1/cms/assets` returns 401.
- Authenticated Screen Owner cannot call CMS asset creation; expect 403.
- Content Manager can create asset metadata and receive a presigned URL when storage is configured.
- Unsupported MIME types and size over 500 MiB are rejected.
- Cross-organization asset IDs cannot be read/changed through organization-scoped queries.
- Layout with 0 or >20 zones is rejected.
- Duplicate zone IDs and zones outside canvas bounds are rejected.
- Playlist cannot be created unless all referenced assets are READY and in the same organization.
- Playlist activation fails if any asset is no longer READY.
- Directly changing an asset to READY is rejected.
- Audit records are created for CMS state changes.

## UI checks
- `/cms` loads on desktop and mobile widths.
- Tab navigation switches between Layout Studio, Media Library and Playlists.
- Add/remove zone and field editing work locally.
- Empty media and playlist states are readable on narrow screens.
- Confirm all messages explicitly distinguish local preview state from API persistence.

## Must pass before production
- Unit and integration tests against real MySQL and MinIO.
- Object verification worker and malware scanning.
- Presigned URL expiration and object-size enforcement.
- API rate limits, request size limits, organization authorization tests.
- Full build, lint and dependency vulnerability audit.
