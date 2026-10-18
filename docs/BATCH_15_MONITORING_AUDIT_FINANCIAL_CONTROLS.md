# BATCH 15 — Monitoring, Auditability & Financial Controls

## Implemented

- Durable MySQL `NotificationOutbox` table with idempotent `eventKey`, payload, attempts, retry time, processing lease, delivery timestamp, and terminal failure state.
- Incident creation and operational alert scans enqueue notifications instead of making best-effort fire-and-forget webhook requests.
- Worker claims outbox rows with conditional updates, so competing replicas should not normally deliver the same row concurrently. Delivery is **at-least-once**, not exactly-once: a crash after remote delivery but before the database update can cause a retry. Receivers should honor the incident ID / idempotency key.
- Exponential retry backoff, stale processing lease recovery, terminal failure after configurable row-level `maxAttempts` (default 8), and audit events for delivery/retry/failure.
- Existing audit events remain the source for incident lifecycle and operator actions.

## Deployment

1. Back up MySQL.
2. Run `npx prisma migrate deploy` after confirming the migration is present in the release.
3. Run `npx prisma generate` during build/release.
4. Configure `ALERT_WEBHOOK_URL` with HTTPS and exact hostnames in `ALERT_WEBHOOK_ALLOWED_HOSTS`.
5. Set `NOTIFICATION_OUTBOX_ENABLED=true`; interval minimum is 5 seconds.
6. Monitor rows in `PROCESSING` beyond two minutes, rows in `FAILED`, and audit actions `NOTIFICATION_RETRY_SCHEDULED` / `NOTIFICATION_FAILED`.
7. Test webhook outage, recovery, duplicate enqueue, and stale lease recovery in staging.

## Financial control boundary

This batch does **not** initiate payments. Verified playback events remain candidate evidence only. Before any owner reward or advertiser invoice, require a separately approved policy for device eligibility, target thresholds, campaign availability, duplicate/replay/fraud checks, payout period, organization ownership, finance maker-checker approval, immutable approval audit, and reconciliation. The indicative ₹1,000 TV / ₹333 smartphone monthly amounts are not an unconditional entitlement; the configured minimum valid playback target and other plan conditions must be met.

## Known limitations / follow-up

- Webhook retries are durable; email/SMS/WhatsApp providers and dead-letter replay UI are not included.
- No metrics endpoint or central log aggregation vendor is wired in this batch; deploy structured logs and external metrics/alerting as an infrastructure task.
- Outbox delivery is at-least-once, and remote webhook consumers should deduplicate.
- The service currently creates separate audit records after delivery state updates; failures between those writes can leave a delivery state without its corresponding audit event. Consider transactional eventing/audit reconciliation in a later hardening batch.
- No real MySQL, multi-replica, or live webhook integration tests were run in this environment.
