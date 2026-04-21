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

Installer sẽ tạo `.env` tự động (`OPENCLAW_TOKEN` + `SETUP_SESSION_SECRET` random), build 5 image (bot, 9router, zalo, setup, nginx), kéo `nginx:alpine`, rồi `docker compose up -d`.

## 4. Cấu hình qua Setup UI

Mở browser → `https://<host>:9504/setup` → chấp nhận cert self-signed.

### Lần đầu: tạo mật khẩu admin
Form "Thiết lập mật khẩu admin" hiện ra. Nhập mật khẩu (≥ 6 ký tự) → **Tạo & đăng nhập**.

Lưu vào volume `setup-data/auth.json` (bcrypt). Không bao giờ plaintext.

### Tab **General**
- **Tên bot** — ví dụ `Jessica`
- **Model mặc định** — ví dụ `9router/gemini/gemini-2.5-flash`
- **System prompt** — persona + hướng dẫn trả lời

Bấm **Lưu** → về Dashboard bấm **Restart bot**.

### Tab **Providers** (LLM)
Thêm lần lượt các nhà cung cấp:

| Provider    | Key format              | Lấy ở đâu                                   |
|-------------|-------------------------|---------------------------------------------|
| gemini      | `AIzaSy...`             | https://aistudio.google.com                 |
| openrouter  | `sk-or-v1-...`          | https://openrouter.ai/keys                  |
| nvidia      | `nvapi-...`             | https://build.nvidia.com                    |
| openai      | `sk-...`                | https://platform.openai.com/api-keys        |
| anthropic   | `sk-ant-...`            | https://console.anthropic.com               |

Sau khi thêm → Dashboard → **Restart 9router**.

### Tab **Channels**
- **Zalo Personal** — bật checkbox. Không cần token.
- **Telegram** — bật checkbox + paste bot token (`123456:ABC...` lấy từ `@BotFather`).

Bấm **Lưu** → **Restart bot**.

### Tab **Memory**
- `memory-core` (slot owner + dreaming): **bật** nếu muốn bot nhớ lâu.
- `active-memory` (inject context trước DM): **bật** kèm theo.
- **Dreaming cron**: mặc định `0 3 * * *` (3AM VN). Cron expression 5 trường chuẩn.

## 5. Đăng nhập Zalo Personal

1. Mở `https://<host>:9504/zalo`.
2. Scan QR bằng app Zalo Personal trên điện thoại.
3. Session lưu volume `zalo-data`. Không cần scan lại nếu chưa logout.

## 6. Test bot

DM bot trên Zalo → bot reply.

## Quên mật khẩu Setup?

Xoá file auth để reset về first-run:
```bash
docker exec openclaw-setup rm /data/setup/auth.json
docker compose restart setup
```
Mở lại `/setup` → form tạo mật khẩu mới hiện ra.
