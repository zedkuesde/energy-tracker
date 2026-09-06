#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/docker-restore.sh backups/energy-tracker-YYYYMMDD-HHMMSS.sqlite" >&2
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

BACKUP_INPUT=$1
case "$BACKUP_INPUT" in
  /*) BACKUP_ABS=$BACKUP_INPUT ;;
  *) BACKUP_ABS="$ROOT/$BACKUP_INPUT" ;;
esac

BACKUP_NAME=$(basename "$BACKUP_ABS")
case "$BACKUP_NAME" in
  *.sqlite) ;;
  *)
    echo "Le fichier de sauvegarde doit se terminer par .sqlite." >&2
    exit 1
    ;;
esac

if [ ! -f "$BACKUP_ABS" ]; then
  echo "Fichier de sauvegarde introuvable." >&2
  exit 1
fi

STAMP=$(date -u +%Y%m%d-%H%M%S)
SAFETY_NAME="energy-tracker-before-restore-${STAMP}.sqlite"

mkdir -p "$ROOT/backups"
cp "$BACKUP_ABS" "$ROOT/backups/${BACKUP_NAME}"

docker compose stop energy-tracker
docker compose run --rm --no-deps \
  -v "$ROOT/backups:/backups" \
  energy-tracker \
  node dist/server/backup.js "/backups/${SAFETY_NAME}"
docker compose run --rm --no-deps \
  -v "$ROOT/backups:/backups" \
  energy-tracker \
  node dist/server/restore.js "/backups/${BACKUP_NAME}"
docker compose start energy-tracker

echo "Restauration terminée. Copie de sécurité : backups/${SAFETY_NAME}"
echo "Vérifier ensuite : curl -i http://127.0.0.1:3020/health puis la page de login."
