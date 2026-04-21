#!/usr/bin/env bash
# Pull code mới + rebuild + up -d
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

echo "[update] git pull"
git pull --ff-only

echo "[update] rebuild images (no-cache cho bot/9router để lấy npm @latest)"
docker compose build --no-cache ai-bot 9router
docker compose build zalo

echo "[update] up -d"
docker compose up -d

docker compose ps
