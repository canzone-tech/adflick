#!/usr/bin/env bash
set -Eeuo pipefail
# Run from repo root with production Compose and a configured .env.production.
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
OUT="$BACKUP_DIR/adflick-mysql-$STAMP.sql.gz"
if [[ -e "$OUT" ]]; then echo "Refusing to overwrite existing backup: $OUT" >&2; exit 2; fi
umask 077
docker compose --env-file .env.production -f "$COMPOSE_FILE" exec -T mysql sh -ec 'exec mysqldump --single-transaction --routines --triggers --events --hex-blob -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' | gzip -9 > "$OUT"
if [[ ! -s "$OUT" ]]; then rm -f "$OUT"; echo 'Backup output is empty; removed.' >&2; exit 1; fi
gzip -t "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
chmod 600 "$OUT" "$OUT.sha256"
echo "Backup created and gzip-verified: $OUT"
echo 'Copy the backup and checksum to an encrypted off-host location; a local backup alone is not disaster recovery.'
