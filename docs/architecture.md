# Openclaw — Architecture

## Sơ đồ

```
                  ┌──────────────────────────────────────┐
                  │            Host (Linux)              │
                  │                                      │
  :9504 ───►      │  ┌──────────┐    ┌──────────────┐    │
  (HTTPS)         │  │  nginx   │──► │   ai-bot     │    │
                  │  │  (443)   │    │  gateway     │    │
                  │  └──────────┘    │  :18788/89   │    │
                  │        │         └──────┬───────┘    │
                  │        │                │            │
                  │        │       ┌────────▼────────┐   │
                  │        │       │    9router      │   │
                  │        │       │   (LLM proxy)   │   │
  :20128 ─────────┼────────┼──────►│     :20128      │   │
  (Dashboard)     │        │       └────────┬────────┘   │
                  │        │                │            │
                  │        │                ▼            │
                  │        │      Gemini / OpenRouter    │
                  │        │         / NVIDIA / …        │
                  │        │                             │
                  │        ▼                             │
                  │   ┌─────────┐                        │
                  │   │  zalo   │  (QR dashboard +       │
                  │   │ sidecar │   Zalo Personal WS)    │
                  │   └─────────┘                        │
                  │                                      │
                  └──────────────────────────────────────┘
```

## Containers

| Container          | Image                | Purpose                                            |
|--------------------|----------------------|----------------------------------------------------|
| `openclaw-bot`     | `openclaw/bot:local` | Chạy `openclaw gateway run`. Nghe `:18788`.        |
| `openclaw-9router` | `openclaw/9router:local` | LLM proxy + routing combo. Dashboard `:20128`. |
| `openclaw-zalo`    | `openclaw/zalo:local` | Sidecar serve QR dashboard cho Zalo Personal.     |
| `openclaw-setup`   | `openclaw/setup:local` | Web UI admin. **Không expose port** — qua nginx `/setup`. |
| `openclaw-nginx`   | `nginx:alpine`       | HTTPS reverse proxy `:9504` → setup + zalo + bot. |

## Volumes

| Volume        | Mount                        | Nội dung                                      |
|---------------|------------------------------|-----------------------------------------------|
| `bot-home`    | `/root/.openclaw`            | Config + memory DB + sessions + credentials. |
| `router-data` | `/data/.9router`             | `db.json` (providers, combos, API keys).      |
| `zalo-data`   | `/data`                      | Zalo session, cookies.                        |
| `openclaw-tmp`| `/tmp/openclaw` + `/openclaw-tmp` | QR png share giữa bot ↔ zalo.         |
| `nginx-ssl`   | `/etc/nginx/ssl`             | Cert self-signed auto-sinh lần đầu.          |
| `setup-data`  | `/data/setup` (trong setup)  | `auth.json` (bcrypt password admin).          |

## Network

Docker network mặc định của compose. Các service gọi nhau qua **tên service** (không IP):

- `ai-bot` gọi `http://9router:20128/v1` để lấy LLM completion.
- `zalo` gọi `http://ai-bot:18788` để push message vào gateway.
- `setup` mount chung volume `bot-home` + `router-data` để edit `openclaw.json` / `db.json`. Mount `docker.sock` để restart container.
- `nginx` route: `/setup` → `setup:3000`, `/zalo` → `zalo:3000`, còn lại → `ai-bot:18789`.

## Ports expose ra host

| Port host | Nguồn              | Mục đích                         |
|-----------|--------------------|----------------------------------|
| `9504`    | `nginx:443`        | HTTPS gateway + Zalo QR.         |
| `20128`   | `9router:20128`    | Dashboard quản lý LLM provider.  |

## Secrets

Không có secret hardcode trong image. Tất cả đi qua:

- `.env` (trên host, **không commit**) → `OPENCLAW_TOKEN`, `SETUP_SESSION_SECRET`, API keys optional.
- Volume `bot-home/openclaw.json` → 9router apiKey + gateway.token. Edit qua **Setup UI**.
- Volume `router-data/db.json` → provider API keys. Edit qua **Setup UI**.
- Volume `setup-data/auth.json` → bcrypt hash password admin Setup UI.

### Tại sao Setup UI không expose port?

Setup UI chỉ đi qua nginx (HTTPS + self-signed cert). Truy cập nội bộ docker network → không có port trần ra internet → hạn chế surface attack. Cần VPN/SSH tunnel nếu muốn access từ xa.

## Extension points

- **Thêm channel** (Telegram, QQ, …): sửa `openclaw.json` → `channels.<name>.enabled: true` → cấp token → restart `ai-bot`.
- **Thêm agent**: thêm block trong `agents` của `openclaw.json`.
- **Thêm LLM provider**: dashboard 9router → Add connection.
