#!/usr/bin/env bash
# Tail logs của từng service (hoặc all nếu không truyền arg)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

if [ $# -eq 0 ]; then
  exec docker compose logs -f --tail=200
fi

exec docker compose logs -f --tail=200 "$@"
