# BATCH 03 — CMS, media, layouts and playlists

## Included
- Prisma models for `ScreenLayout`, `Playlist`, and `MediaAssetVersion`
- MySQL migration for those models and a media status/MIME index
- Organization-scoped CMS service queries using the authenticated user's organization
- Role-guarded media, layout and playlist routes
- S3-compatible pre-signed upload URL generation (5-minute expiry)
- Allowed MIME-type metadata checks and a 500 MiB declared-size ceiling
- Layout canvas bounds and zone-count validation
- Playlist validation against READY media assets in the same organization
- Audit events for media, layout and playlist actions
- Responsive `/cms` frontend preview for layouts, media metadata and playlist selection

## Routes
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cms/assets` | List assets for authenticated organization |
| POST | `/api/v1/cms/assets` | Create asset metadata and get a pre-signed upload URL |
| POST | `/api/v1/cms/assets/:id/complete-upload` | Request media processing after client upload |
| PATCH | `/api/v1/cms/assets/:id/status` | Reject/archive an asset |
| GET | `/api/v1/cms/layouts` | List layouts |
| POST | `/api/v1/cms/layouts` | Create layout draft |
| POST | `/api/v1/cms/layouts/:id/publish` | Publish layout |
| GET | `/api/v1/cms/playlists` | List playlists |
| POST | `/api/v1/cms/playlists` | Create playlist draft using READY assets |
| POST | `/api/v1/cms/playlists/:id/activate` | Activate playlist after revalidating assets |

All CMS routes require an access token. Role metadata controls which role groups can call each route.

## Object storage
Configure `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Local Compose includes a MinIO service; create the bucket in the MinIO console before trying upload URL generation.

The API generates a short-lived signed URL. Client upload must use HTTP PUT to that URL with the expected `Content-Type`. Storage CORS may need to allow the portal origin.

## Important validation and production limitations
- `POST /assets/:id/complete-upload` currently moves the asset to PROCESSING and records a supplied checksum claim. It does not read or hash the actual stored bytes.
- A trusted worker must fetch the uploaded object, verify byte size, actual MIME type, checksum, malware scan and media decoding/transcoding before setting status to READY.
- The public API deliberately cannot set an asset directly to READY.
- Presigned uploads should be followed by object HEAD and server-side verification; do not trust browser-provided MIME type or checksum.
- The current UI is a browser-state preview and is not wired to login or the API. It never uploads media bytes.
- Layout JSON is validated for bounds and unique zone IDs, but overlapping zones are permitted intentionally. Add stricter constraints if product rules require them.
- Publishing a layout increments its version; full immutable version history and rollback are future work.
- Playlist scheduling, screen targeting, conflict resolution, media transcoding, CDN delivery and player sync are not implemented yet.
