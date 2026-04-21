# Openclaw — Release Package

Đóng gói Openclaw thành stack Docker 1-click: `ai-bot` + `9router` + `zalo` + `nginx`.

## Yêu cầu

- Linux (khuyến nghị Ubuntu 22.04/24.04) hoặc macOS
- Docker Engine 24+ và Docker Compose plugin

Kiểm tra nhanh:

```bash
docker --version
docker compose version
```

## Cài đặt 3 bước

```bash
git clone <url-repo-cua-ban> openclaw
cd openclaw
./install.sh
```

Script sẽ:

1. Tạo `.env` từ `.env.example` và tự random `OPENCLAW_TOKEN`.
2. Build 3 image (`bot`, `zalo`, `9router`) + kéo image `nginx:alpine`.
3. Chạy `docker compose up -d`.

Sau khi chạy xong, mở:

| Dịch vụ             | URL                                       |
|---------------------|-------------------------------------------|
| **Setup UI (admin)** | `https://<host>:9504/setup`              |
| Zalo QR             | `https://<host>:9504/zalo`                |
| Dashboard 9router   | `http://<host>:20128`                     |
| Gateway Openclaw    | `https://<host>:9504`                     |

> Cert là self-signed, browser sẽ cảnh báo lần đầu — accept qua.

## Cấu hình sau cài đặt — chỉ qua **Setup UI**

Mở `https://<host>:9504/setup`:

1. **Lần đầu** → tạo mật khẩu admin.
2. Tab **General** → tên bot, system prompt, model mặc định.
3. Tab **Providers** → thêm API keys (Gemini / OpenRouter / NVIDIA …). Bấm **Restart 9router**.
4. Tab **Channels** → bật Zalo Personal / Telegram + nhập token.
5. Tab **Memory** → bật active-memory + dreaming cron.
6. Dashboard → bấm **Restart bot**.
7. Vào `/zalo` scan QR (nếu đã bật Zalo).

> Tất cả edit JSON đều qua UI. Không cần `docker exec` mò vào container.

## Thư mục

```
openclaw-release/
├── docker-compose.yml        # 4 service
├── install.sh                # one-shot installer
├── .env.example              # biến môi trường (copy sang .env)
├── docker/
│   ├── bot/        Dockerfile + patch-openclaw.js + entrypoint
│   ├── 9router/    Dockerfile + entrypoint
│   ├── zalo/       Dockerfile + server.js + package.json
│   ├── setup/      Web UI admin (Express + EJS) — KHÔNG expose port
│   └── nginx/      nginx.conf (route /setup, /zalo, /)
├── config/
│   ├── openclaw/openclaw.json.example
│   └── 9router/db.json.example
├── scripts/
│   ├── logs.sh          # docker compose logs -f
│   ├── update.sh        # git pull + rebuild + up -d
│   ├── backup.sh        # dump volumes -> backups/<stamp>/
│   └── restore.sh       # restore volumes từ backup
└── docs/
    ├── setup.md         # hướng dẫn chi tiết
    ├── troubleshooting.md
    └── architecture.md
```

## Vận hành

```bash
# Xem trạng thái
docker compose ps

# Xem log 1 service
./scripts/logs.sh ai-bot
./scripts/logs.sh 9router

# Restart bot
docker compose restart ai-bot

# Dừng toàn bộ
docker compose down

# Dừng + xoá volume (MẤT DATA)
docker compose down -v

# Backup data
./scripts/backup.sh

# Restore
./scripts/restore.sh 20260421-101500

# Upgrade (pull code + rebuild)
./scripts/update.sh
```

## Ghi chú

- Repo này **không chứa API key thật**. Tất cả placeholder `REPLACE_WITH_*` phải được thay sau khi cài.
- Patch `docker/bot/patch-openclaw.js` fix race condition upload file qua Zalo (file_done WS event arriving before callback). Không critical nhưng nên giữ.
- Stack mặc định gắn `restart: always` → boot máy là tự lên, không cần systemd.

Xem thêm [docs/setup.md](docs/setup.md) • [docs/troubleshooting.md](docs/troubleshooting.md) • [docs/architecture.md](docs/architecture.md).
