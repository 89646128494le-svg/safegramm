#!/bin/bash
# Скрипт автоматического бэкапа для SafeGram

set -e

# Конфигурация
BACKUP_DIR="${BACKUP_DIR:-/opt/safegram/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-safegram-db-1}"
DB_NAME="${DB_NAME:-safegram_prod}"
DB_USER="${DB_USER:-safegram}"
REDIS_CONTAINER="${REDIS_CONTAINER:-safegram-redis-1}"

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

# Дата и время для имени файла
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting backup at $(date)"

# Бэкап базы данных
echo "Backing up database..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

if [ $? -eq 0 ]; then
    echo "Database backup completed: db_${TIMESTAMP}.sql.gz"
else
    echo "ERROR: Database backup failed!"
    exit 1
fi

# Бэкап Redis (опционально)
if docker ps | grep -q "$REDIS_CONTAINER"; then
    echo "Backing up Redis..."
    docker exec "$REDIS_CONTAINER" redis-cli --no-auth-warning SAVE
    docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    if [ $? -eq 0 ]; then
        echo "Redis backup completed: redis_${TIMESTAMP}.rdb"
    else
        echo "WARNING: Redis backup failed (non-critical)"
    fi
fi

# Удаление старых бэкапов
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.rdb" -mtime +$RETENTION_DAYS -delete

# Проверка размера бэкапов
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backup size: $BACKUP_SIZE"

echo "Backup completed successfully at $(date)"

# Опционально: отправка уведомления
# Можно добавить отправку email или webhook при ошибках
