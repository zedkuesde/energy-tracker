#!/usr/bin/env sh
set -eu

usage() {
  cat >&2 <<'EOF'
Usage: scripts/docker-backup.sh [--no-restart] [--image RÉFÉRENCE]

Arrête energy-tracker, écrit une sauvegarde SQLite, puis redémarre le service.

  --no-restart    laisse energy-tracker arrêté, y compris si la sauvegarde échoue
  --image REF     utilise exactement cette image pour le conteneur de sauvegarde

Sans --image, le conteneur utilise l'image actuelle du service.
La sauvegarde est d'abord écrite dans backups/.partial/. Le fichier final
n'est publié que s'il existe et n'est pas vide. backups/.partial/ n'est pas
une sauvegarde valide.
EOF
}

RESTART=1
IMAGE=

while [ $# -gt 0 ]; do
  case "$1" in
    --no-restart)
      RESTART=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --image)
      if [ $# -lt 2 ] || [ -z "${2:-}" ] || [ "${2#--}" != "$2" ]; then
        echo "Option --image : référence d'image manquante." >&2
        usage
        exit 1
      fi
      IMAGE=$2
      shift 2
      ;;
    --image=*)
      echo "Option --image : indiquez la référence dans un argument séparé." >&2
      usage
      exit 1
      ;;
    *)
      echo "Option invalide : $1" >&2
      usage
      exit 1
      ;;
  esac
done

ROOT=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILENAME="energy-tracker-${STAMP}.sqlite"
PARTIAL_DIR="$ROOT/backups/.partial"
PARTIAL_PATH="$PARTIAL_DIR/$FILENAME"
FINAL_PATH="$ROOT/backups/$FILENAME"

STOPPED=0
BACKUP_DONE=0

compose_run() {
  if [ -n "$IMAGE" ]; then
    docker compose run --rm --no-deps \
      --image "$IMAGE" \
      -v "$ROOT/backups:/backups" \
      energy-tracker \
      "$@"
  else
    docker compose run --rm --no-deps \
      -v "$ROOT/backups:/backups" \
      energy-tracker \
      "$@"
  fi
}

remove_partial() {
  rm -f "$PARTIAL_PATH" "${PARTIAL_PATH}-wal" "${PARTIAL_PATH}-shm" 2>/dev/null || true
  if [ -e "$FINAL_PATH" ] && [ ! -s "$FINAL_PATH" ]; then
    rm -f "$FINAL_PATH" 2>/dev/null || true
  fi

  partial_left=0
  empty_final_left=0
  if [ -e "$PARTIAL_PATH" ] || [ -e "${PARTIAL_PATH}-wal" ] || [ -e "${PARTIAL_PATH}-shm" ]; then
    partial_left=1
  fi
  if [ -e "$FINAL_PATH" ] && [ ! -s "$FINAL_PATH" ]; then
    empty_final_left=1
  fi

  if [ "$partial_left" -eq 1 ] && [ "$empty_final_left" -eq 1 ]; then
    compose_run rm -f \
      "/backups/.partial/${FILENAME}" \
      "/backups/.partial/${FILENAME}-wal" \
      "/backups/.partial/${FILENAME}-shm" \
      "/backups/${FILENAME}" || true
  elif [ "$partial_left" -eq 1 ]; then
    compose_run rm -f \
      "/backups/.partial/${FILENAME}" \
      "/backups/.partial/${FILENAME}-wal" \
      "/backups/.partial/${FILENAME}-shm" || true
  elif [ "$empty_final_left" -eq 1 ]; then
    compose_run rm -f "/backups/${FILENAME}" || true
  fi

  if [ -e "$PARTIAL_PATH" ] || { [ -e "$FINAL_PATH" ] && [ ! -s "$FINAL_PATH" ]; }; then
    echo "Un fichier incomplet reste présent. Ce n'est pas une sauvegarde valide." >&2
  fi
  rmdir "$PARTIAL_DIR" 2>/dev/null || true
  return 0
}

on_exit() {
  status=$?
  trap - EXIT
  if [ "$BACKUP_DONE" -eq 0 ]; then
    remove_partial
    if [ "$STOPPED" -eq 1 ] && [ "$RESTART" -eq 1 ]; then
      echo "La sauvegarde a échoué. Redémarrage de energy-tracker." >&2
      if ! docker compose start energy-tracker; then
        echo "Le redémarrage de energy-tracker a échoué." >&2
      fi
    elif [ "$STOPPED" -eq 1 ]; then
      echo "La sauvegarde a échoué. Le service energy-tracker reste arrêté." >&2
    fi
  fi
  exit "$status"
}

trap on_exit EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "La commande docker est introuvable." >&2
  exit 1
fi

if [ -n "$IMAGE" ]; then
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Image introuvable : ${IMAGE}" >&2
    usage
    exit 1
  fi
fi

mkdir -p "$ROOT/backups"

if ! docker compose stop energy-tracker; then
  echo "Impossible d'arrêter energy-tracker." >&2
  exit 1
fi
STOPPED=1

# Publication atomique : le nom final n'apparaît qu'après mv d'un fichier non vide.
# shellcheck disable=SC2016 # $1 et $2 sont ceux du shell du conteneur.
BACKUP_SH='set -eu
node dist/server/backup.js "$1"
test -s "$1"
mv "$1" "$2"
rm -f "${1}-wal" "${1}-shm"
'

if ! compose_run sh -c "$BACKUP_SH" sh \
  "/backups/.partial/${FILENAME}" \
  "/backups/${FILENAME}"; then
  echo "La commande de sauvegarde a échoué." >&2
  exit 1
fi

if [ ! -s "$FINAL_PATH" ]; then
  echo "La sauvegarde est absente ou vide." >&2
  exit 1
fi
BACKUP_DONE=1

rm -f "$PARTIAL_PATH" "${PARTIAL_PATH}-wal" "${PARTIAL_PATH}-shm" 2>/dev/null || true
if [ -e "$PARTIAL_PATH" ] || [ -e "${PARTIAL_PATH}-wal" ] || [ -e "${PARTIAL_PATH}-shm" ]; then
  compose_run rm -f \
    "/backups/.partial/${FILENAME}" \
    "/backups/.partial/${FILENAME}-wal" \
    "/backups/.partial/${FILENAME}-shm" || true
fi
if [ -e "$PARTIAL_PATH" ]; then
  echo "Fichier partiel toujours présent : backups/.partial/${FILENAME}. Ce n'est pas une sauvegarde valide." >&2
fi
rmdir "$PARTIAL_DIR" 2>/dev/null || true

if [ "$RESTART" -eq 1 ]; then
  if ! docker compose start energy-tracker; then
    echo "La sauvegarde est écrite dans backups/${FILENAME}, mais le redémarrage de energy-tracker a échoué." >&2
    exit 1
  fi
  echo "Sauvegarde écrite dans backups/${FILENAME}"
else
  echo "backups/${FILENAME}"
fi
