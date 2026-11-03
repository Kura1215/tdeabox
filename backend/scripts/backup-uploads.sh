#!/usr/bin/env bash
# Backup SEMANAL de la multimedia subida por usuarios (RNF04): tar.gz, retencion de 30 dias.
# Cron (domingos a las 03:00):  0 3 * * 0 /ruta/a/tdeavox/backend/scripts/backup-uploads.sh
# Variables: UPLOADS_DIR (por defecto <repo>/uploads) y BACKUP_DIR
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$RAIZ/.env" ]; then
    set -a; . "$RAIZ/.env"; set +a
fi

ORIGEN="${UPLOADS_DIR:-$RAIZ/../uploads}"
DESTINO="${BACKUP_DIR:-$RAIZ/../backups}/uploads"
RETENCION_DIAS=30
mkdir -p "$DESTINO"

ARCHIVO="$DESTINO/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$ARCHIVO" -C "$ORIGEN" .

find "$DESTINO" -name '*.tar.gz' -type f -mtime +"$RETENCION_DIAS" -delete
echo "Backup de multimedia creado: $ARCHIVO"
