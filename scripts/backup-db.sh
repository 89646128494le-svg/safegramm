#!/bin/bash
# Резервное копирование Postgres по DATABASE_URL (без Docker).
# Использование: BACKUP_DIR=/opt/backups ./scripts/backup-db.sh
# Восстановление: gunzip -c backups/db_YYYYMMDD_HHMMSS.sql.gz | psql $DATABASE_URL

set -e
source "${BASH_SOURCE%/*}/../.env" 2>/dev/null || true
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

if [ -z "$DATABASE_URL" ]; then
  echo "Set DATABASE_URL (e.g. postgres://user:pass@host:5432/dbname?sslmode=disable)"
  exit 1
fi

echo "Backing up to $OUT ..."
pg_dump "$DATABASE_URL" | gzip > "$OUT"
echo "Done. Restore: gunzip -c $OUT | psql \"\$DATABASE_URL\""
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
