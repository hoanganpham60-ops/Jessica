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
  # sed portable Linux/macOS
  sed_inplace() {
    if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
  }
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 24)"
    SECRET="$(openssl rand -hex 32)"
    sed_inplace "s|^OPENCLAW_TOKEN=.*|OPENCLAW_TOKEN=${TOKEN}|" .env
    sed_inplace "s|^SETUP_SESSION_SECRET=.*|SETUP_SESSION_SECRET=${SECRET}|" .env
    log "Đã random OPENCLAW_TOKEN + SETUP_SESSION_SECRET."
  else
    log "openssl không có — nhớ điền OPENCLAW_TOKEN và SETUP_SESSION_SECRET thủ công."
  fi
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

   Setup UI:          https://<host>:$(grep -E '^NGINX_PORT' .env | cut -d= -f2)/setup
   Zalo QR:           https://<host>:$(grep -E '^NGINX_PORT' .env | cut -d= -f2)/zalo
   9router dashboard: http://<host>:$(grep -E '^NINEROUTER_PORT' .env | cut -d= -f2)
   Gateway (HTTPS):   https://<host>:$(grep -E '^NGINX_PORT' .env | cut -d= -f2)

 Các bước tiếp theo:
   1. Mở Setup UI → tạo mật khẩu admin (lần đầu).
   2. Tab "Providers" → thêm API keys (Gemini / OpenRouter / …).
   3. Tab "General" → đặt tên bot, system prompt.
   4. Tab "Channels" → bật Zalo/Telegram.
   5. Nhấn "Restart bot" trên Dashboard.
   6. Vào /zalo để scan QR (nếu đã bật Zalo).

 Logs:    ./scripts/logs.sh
 Dừng:    docker compose down
 Upgrade: ./scripts/update.sh
================================================================
EOF
