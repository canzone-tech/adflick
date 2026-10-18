# BATCH 07 acceptance and regression test plan

## Manifest authentication
- Missing, short, oversized or incorrect `x-device-secret` is rejected.
- PENDING_PAIRING, SUSPENDED and RETIRED screens cannot fetch manifests.
- Organization A device cannot receive organization B campaign/creative data.
- Manifest requests are rate limited.
- Missing storage configuration returns service-unavailable rather than exposing a storage key.

## Eligibility
- DRAFT, PENDING_REVIEW, APPROVED, PAUSED, REJECTED and COMPLETED campaigns are excluded.
- ACTIVE campaign outside its time window is excluded.
- Explicit target campaign only appears for its target screen.
- Untargeted campaign is available to screens in the same organization only.
- Non-READY assets or assets without storage keys are excluded.
- Media response includes a short-lived signed URL, never raw object storage keys.

## Playback authorization
- Missing authorization ID/token is rejected.
- Token hash mismatch is rejected.
- Token for another screen, asset, campaign or organization is rejected.
- Expired and consumed tokens are rejected.
- PLAY_STARTED can use a valid token before terminal consumption.
- One terminal event consumes a token; a second terminal event using it is rejected.
- Duplicate screen/eventId is not counted again.
- Rejected events are never counted as candidate qualifying plays.
- Client expected duration cannot override server-known media duration.
- Existing playback report role and tenant controls continue to apply.

## Database and integration
- `npx prisma validate`
- `npm run db:generate`
- Apply migrations against a disposable MySQL 8.4 database.
- Run API/web build, typecheck and lint.
- Test S3-compatible signed downloads and URL expiry.
- Test concurrent terminal events using the same authorization token.
- Test expired authorization cleanup and verify it does not remove valid retry-window records.
- Confirm no payment, invoicing or payout occurs from manifest creation or playback events.
