# BATCH 09 — Offline Player Recovery, Reliable Sync & Device Health

## Delivered in this batch
- Screen health telemetry fields: CPU, memory, storage, capabilities, last successful sync and last player error.
- Heartbeat DTO accepts optional resource metrics, manifest version, sync status and player error.
- Heartbeat preserves operator-set MAINTENANCE state instead of automatically returning it to ONLINE.
- Fleet screen API returns telemetry fields.
- `GET /api/v1/fleet/health-summary` provides organization-scoped health counts and command failure totals for the last 24 hours.
- Device commands now track delivery count, last delivery time and last error.
- Pending commands can be redelivered after 30 seconds, with a maximum of 10 deliveries before being marked FAILED.
- Command results record failure reasons.
- Responsive `/health` sample dashboard for resource use, sync health and recovery preview.
- Player offline cache and durable command-handling protocol.

## Heartbeat endpoint
`POST /api/v1/devices/:id/heartbeat`

The player supplies its device secret, platform, player version and optional CPU/memory/storage percentages, capabilities, manifest version, sync status and error summary. Resource fields are telemetry reported by the player and must not be treated as trusted attestation.

## Health summary endpoint
`GET /api/v1/fleet/health-summary`
- JWT required.
- Organization context required.
- Roles: Super Admin, Organization Admin, Operations Manager, Support Agent, Auditor / Compliance.
- Returns non-retired screen totals, online/offline/maintenance counts, unhealthy count, command count over 24 hours and failed command count over 24 hours.
- “Unhealthy” is currently a rule-based count: a reported player error exists or CPU/memory/storage is at least 95%.

## Command delivery behavior
- Expired pending commands are marked EXPIRED before polling.
- Due pending commands are eligible for redelivery if not delivered in the previous 30 seconds.
- Each delivery increments a counter.
- At 10 deliveries, still-pending commands become FAILED.
- Player must deduplicate command IDs. This delivery mechanism is at-least-once, not exactly-once execution.

## What is not yet implemented
- The web dashboard uses local sample data and does not fetch live API data.
- No native player implementation is included for local asset storage, checksum verification, offline playback, local event queue or automatic reconnect. The protocol describes required player behavior.
- No push alert delivery (email/SMS/WhatsApp), escalation policy or operator acknowledgement workflow.
- No durable distributed queue, backoff scheduler or multi-replica coordination.
- No independent device attestation. Player-reported metrics can be falsified.
- No billing or owner payouts are performed by this batch.
