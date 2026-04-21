#!/bin/sh
set -e

mkdir -p /data/.9router

# Seed db.json từ example nếu volume còn rỗng
if [ ! -f /data/.9router/db.json ] && [ -f /seed/db.json ]; then
  echo "[9router] Seeding default db.json from /seed/db.json"
  cp /seed/db.json /data/.9router/db.json
fi

# 9router CLI bundle server tại app/server.js trong node_modules
NR_DIR="$(npm root -g)/9router"
if [ -f "$NR_DIR/app/server.js" ]; then
  cd "$NR_DIR"
  exec node app/server.js
else
  # fallback: gọi CLI
  exec 9router start
fi
