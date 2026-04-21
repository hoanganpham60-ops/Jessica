#!/bin/sh
set -e

# First-run seeding: copy openclaw.json.example into volume if user chưa có
if [ ! -f /root/.openclaw/openclaw.json ] && [ -f /seed/openclaw.json ]; then
  echo "[bot] Seeding default openclaw.json from /seed/openclaw.json"
  mkdir -p /root/.openclaw
  cp /seed/openclaw.json /root/.openclaw/openclaw.json
fi

# Optional gog config restore (giữ parity với stack cũ; không bắt buộc)
mkdir -p /root/.config
if [ -d /root/.openclaw/gogcli ]; then
  cp -r /root/.openclaw/gogcli /root/.config/gogcli || true
fi

# Port forwarder for nginx compat (18789 -> 18788)
socat TCP-LISTEN:18789,fork,reuseaddr TCP:127.0.0.1:18788 &

exec openclaw gateway run
