#!/usr/bin/env bash
# Dump toàn bộ data volumes vào thư mục ./backups/YYYYmmdd-HHMMSS/
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${STAMP}"
mkdir -p "$OUT"

dump() {
  local vol="$1"
  local file="$2"
  echo "[backup] ${vol} -> ${file}"
  docker run --rm -v "${vol}:/src:ro" -v "$(pwd)/${OUT}:/out" alpine \
    tar czf "/out/${file}" -C /src .
}

# Compose tự prefix volume tên = "<project>_<volume>". Lấy project name từ basename.
PROJ="$(basename "$HERE" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

dump "${PROJ}_bot-home"     bot-home.tgz
dump "${PROJ}_router-data"  router-data.tgz
dump "${PROJ}_zalo-data"    zalo-data.tgz
dump "${PROJ}_nginx-ssl"    nginx-ssl.tgz

echo "[backup] xong: ${OUT}"
