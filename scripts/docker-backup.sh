#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILENAME="energy-tracker-${STAMP}.sqlite"

mkdir -p "$ROOT/backups"

docker compose stop energy-tracker
docker compose run --rm --no-deps \
  -v "$ROOT/backups:/backups" \
  energy-tracker \
  node dist/server/backup.js "/backups/${FILENAME}"
docker compose start energy-tracker

echo "Sauvegarde écrite dans backups/${FILENAME}"
