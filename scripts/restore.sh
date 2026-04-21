#!/usr/bin/env bash
# Restore từ ./backups/<stamp>/. Stack phải DOWN trước khi restore.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

if [ $# -lt 1 ]; then
  echo "usage: $0 <backup-stamp>   (ví dụ 20260421-101500)"
  exit 1
fi

STAMP="$1"
SRC="backups/${STAMP}"
if [ ! -d "$SRC" ]; then
  echo "không tìm thấy $SRC"; exit 1
fi

echo "[restore] đảm bảo stack đã down ..."
docker compose down

PROJ="$(basename "$HERE" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

restore() {
  local vol="$1"
  local file="$2"
  [ -f "${SRC}/${file}" ] || { echo "[restore] skip ${file}"; return; }
  echo "[restore] ${file} -> ${vol}"
  docker volume create "${vol}" >/dev/null
  docker run --rm -v "${vol}:/dst" -v "$(pwd)/${SRC}:/src:ro" alpine \
    sh -c "cd /dst && tar xzf /src/${file}"
}

restore "${PROJ}_bot-home"     bot-home.tgz
restore "${PROJ}_router-data"  router-data.tgz
restore "${PROJ}_zalo-data"    zalo-data.tgz
restore "${PROJ}_nginx-ssl"    nginx-ssl.tgz

echo "[restore] xong. Chạy: docker compose up -d"
