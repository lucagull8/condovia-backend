#!/bin/bash
set -e

BACKUP_DIR="/home/condovia/backups"
LOG="${BACKUP_DIR}/backup.log"
DATE=$(date +%Y%m%d_%H%M)
DEST="${BACKUP_DIR}/backup_${DATE}"

echo "[$(date)] Inizio backup..." >> "$LOG"

mongodump \
  --uri="$MONGODB_URI" \
  --out="$DEST" \
  --quiet

echo "[$(date)] Backup salvato in ${DEST}" >> "$LOG"

# Retention 7 giorni
find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort | head -n -7 | while read old; do
  rm -rf "$old"
  echo "[$(date)] Rimosso backup vecchio: $old" >> "$LOG"
done

echo "[$(date)] Backup completato." >> "$LOG"

# Aggiungi al cron con:
# 0 3 * * * MONGODB_URI=mongodb://... /home/condovia/scripts/backup-mongo.sh
