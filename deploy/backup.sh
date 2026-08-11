#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/data/backups/accessicheck"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "=== backup base SQLite (volume accessicheck-data) ==="
docker run --rm \
  -v accessicheck-data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:latest \
  tar czf "/backup/accessicheck-data-${DATE}.tar.gz" -C /data .

echo "=== nettoyage des sauvegardes de plus de 14 jours ==="
find "$BACKUP_DIR" -type f -name '*.tar.gz' -mtime +14 -delete

echo "[OK] backup effectué : ${BACKUP_DIR}/accessicheck-data-${DATE}.tar.gz"
ls -lh "${BACKUP_DIR}/accessicheck-data-${DATE}.tar.gz"
