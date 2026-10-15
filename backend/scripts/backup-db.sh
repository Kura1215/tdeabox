#!/usr/bin/env bash
# Backup DIARIO de la base de datos (RNF04): volcado comprimido, retencion de 15 dias.
# Cron (todos los dias a las 02:00):  0 2 * * * /ruta/a/tdeavox/backend/scripts/backup-db.sh
# Variables (o lee backend/.env): DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD BACKUP_DIR
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$RAIZ/.env" ]; then
    set -a; . "$RAIZ/.env"; set +a
fi

DESTINO="${BACKUP_DIR:-$RAIZ/../backups}/db"
RETENCION_DIAS=15
mkdir -p "$DESTINO"

ARCHIVO="$DESTINO/${DB_NAME:-tdeavox}_$(date +%Y%m%d_%H%M%S).sql.gz"

# --single-transaction: copia consistente sin bloquear la app (InnoDB)
# la clave va por MYSQL_PWD para que no aparezca en la lista de procesos
MYSQL_PWD="${DB_PASSWORD:-}" mysqldump \
    --host="${DB_HOST:-localhost}" --port="${DB_PORT:-3306}" --user="${DB_USER:-root}" \
    --single-transaction --routines --triggers "${DB_NAME:-tdeavox}" | gzip > "$ARCHIVO"

find "$DESTINO" -name '*.sql.gz' -type f -mtime +"$RETENCION_DIAS" -delete
echo "Backup de BD creado: $ARCHIVO"
