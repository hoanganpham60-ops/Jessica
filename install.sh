#!/usr/bin/env bash
# =========================================================
# Openclaw — one-shot installer
#   - Kiểm tra docker + compose plugin
#   - Sinh .env từ .env.example nếu chưa có (tự random OPENCLAW_TOKEN)
#   - Build & up toàn bộ stack
# =========================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

log() { printf '\033[1;34m[openclaw]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[openclaw]\033[0m %s\n' "$*" >&2; }

# 1. Pre-flight
if ! command -v docker >/dev/null 2>&1; then
  err "Docker chưa được cài. Hướng dẫn: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose plugin không tìm thấy. Cài 'docker-compose-plugin' hoặc dùng Docker Desktop."
  exit 1
fi

# 2. .env
if [ ! -f .env ]; then
  log "Tạo .env từ .env.example ..."
  cp .env.example .env
  # Tự sinh OPENCLAW_TOKEN
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 24)"
    # sed portable Linux/macOS
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^OPENCLAW_TOKEN=.*|OPENCLAW_TOKEN=${TOKEN}|" .env
    else
      sed -i '' "s|^OPENCLAW_TOKEN=.*|OPENCLAW_TOKEN=${TOKEN}|" .env
    fi
    log "Đã random OPENCLAW_TOKEN."
  else
    log "openssl không có — nhớ vào .env điền OPENCLAW_TOKEN thủ công."
  fi
  log "==> Mở .env để điền GOOGLE_API_KEY / TELEGRAM_BOT_TOKEN (tuỳ chọn)."
fi

# 3. Build & up
log "Build images ..."
docker compose build

log "Khởi động stack ..."
docker compose up -d

log "Chờ 3s cho container ổn định ..."
sleep 3
docker compose ps

cat <<EOF

================================================================
 Openclaw đã chạy. Các điểm truy cập:

   Dashboard 9router: http://<host>:$(grep -E '^NINEROUTER_PORT' .env | cut -d= -f2)
   Gateway (HTTPS):   https://<host>:$(grep -E '^NGINX_PORT' .env | cut -d= -f2)
   Zalo QR:           https://<host>:$(grep -E '^NGINX_PORT' .env | cut -d= -f2)/zalo

 Việc cần làm ngay:
   1. Mở dashboard 9router → thêm API keys provider (Gemini/OpenRouter/…)
   2. Sửa /root/.openclaw/openclaw.json trong volume bot nếu cần:
        docker exec -it openclaw-bot sh
   3. Scan QR Zalo: mở /zalo trên nginx

 Logs:    ./scripts/logs.sh
 Dừng:    docker compose down
 Upgrade: ./scripts/update.sh
================================================================
EOF
