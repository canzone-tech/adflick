#!/usr/bin/env bash
set -Eeuo pipefail
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
: "${BACKUP_FILE:?Set BACKUP_FILE to a verified .sql.gz backup}"
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo 'DESTRUCTIVE OPERATION: set CONFIRM_RESTORE=YES after confirming target database and backup.' >&2
  exit 2
fi
[[ -f "$BACKUP_FILE" && -s "$BACKUP_FILE" ]] || { echo 'Backup file missing or empty.' >&2; exit 2; }
gzip -t "$BACKUP_FILE"
if [[ -f "$BACKUP_FILE.sha256" ]]; then (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256"); fi
echo 'Restoring SQL into the configured database. This does not merge data; inspect dump contents and target first.'
gzip -dc "$BACKUP_FILE" | docker compose --env-file .env.production -f "$COMPOSE_FILE" exec -T mysql sh -ec 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
echo 'Restore command completed. Verify row counts, application workflows, and a fresh readiness check before returning traffic.'
