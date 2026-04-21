# Openclaw — Hướng dẫn cài đặt chi tiết

## 1. Cài Docker

### Ubuntu / Debian
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login lại để quyền có hiệu lực
```

### macOS
Cài [Docker Desktop](https://www.docker.com/products/docker-desktop/).

Verify:
```bash
docker --version
docker compose version
```

## 2. Clone repo

```bash
git clone <URL> openclaw
cd openclaw
```

## 3. Chạy installer

```bash
./install.sh
```

Installer sẽ tạo `.env` tự động. Sau đó mở `.env` để xem/sửa:

```bash
# Ports
NGINX_PORT=9504           # HTTPS gateway
NINEROUTER_PORT=20128     # 9router dashboard

# Token auth giữa zalo connector <-> bot gateway
OPENCLAW_TOKEN=<đã random tự động>

# API keys tuỳ chọn
GOOGLE_API_KEY=
TELEGRAM_BOT_TOKEN=
```

## 4. Cấu hình 9router

Mở `http://<host>:20128`:

1. **Providers** → Add connection → chọn Gemini/OpenRouter/NVIDIA/… → paste API key.
2. **Combos** → tạo combo (hoặc dùng `combo1` có sẵn) → gán các provider vào theo priority.
3. **API Keys** → copy key `local-default` (hoặc tạo key mới) để dán vào `openclaw.json` của bot.

## 5. Cấu hình bot Openclaw

Mặc định lần đầu boot, container sẽ seed `config/openclaw/openclaw.json.example` thành `/root/.openclaw/openclaw.json` trong volume `bot-home`.

Sửa trong container:

```bash
docker exec -it openclaw-bot sh
cd /root/.openclaw
vi openclaw.json
```

Các field quan trọng:

| Field | Ý nghĩa |
|---|---|
| `models.providers.9router.baseUrl` | Phải là `http://9router:20128/v1` (tên service trong docker network) |
| `models.providers.9router.apiKey` | Paste key lấy từ 9router ở bước 4 |
| `agents.defaults.memorySearch.remote.apiKey` | Cũng paste key 9router vào đây |
| `gateway.token` | Phải trùng `OPENCLAW_TOKEN` trong `.env` |

Sau khi sửa:
```bash
docker compose restart ai-bot
```

## 6. Đăng nhập Zalo Personal

1. Mở `https://<host>:9504/zalo` (accept cert self-signed).
2. Scan QR bằng app Zalo Personal trên điện thoại.
3. Session sẽ được lưu trong volume `zalo-data`. Không cần scan lại nếu không logout.

## 7. Test bot

DM bot trên Zalo → bot reply. Nếu không reply, xem [troubleshooting.md](troubleshooting.md).
