# Openclaw — Troubleshooting

## Bot không reply trên Zalo

```bash
docker compose ps
./scripts/logs.sh ai-bot
```

- **Container ai-bot không up** → xem log, thường do `openclaw.json` sai JSON.
- **Log có `LLM request failed: network connection error`** → 9router chết hoặc sai apiKey.
  ```bash
  docker compose restart 9router
  docker exec openclaw-bot node -e 'fetch("http://9router:20128/v1/models").then(r=>r.text()).then(console.log)'
  ```
- **Log `401 Unauthorized`** → apiKey trong `openclaw.json` không khớp key trong 9router dashboard.

## Zalo hiện "stopped" sau khi restart bot

Đây là quirk đã biết: `zalouser` channel không cold-boot được.

Fix: vào `openclaw.json` → `channels.zalouser.enabled: false` → save → restart bot → đổi lại `true` → restart lần nữa.

```bash
docker exec -it openclaw-bot sh
vi /root/.openclaw/openclaw.json   # enabled: false
exit
docker compose restart ai-bot
# đợi 10s
docker exec -it openclaw-bot sh
vi /root/.openclaw/openclaw.json   # enabled: true
exit
docker compose restart ai-bot
```

## Bot trả lời lặp y hệt câu cũ

Bug resend-last-success khi LLM timeout. Root cause thường do provider/model trong combo đang dùng bị treo (ví dụ NVIDIA hay lag).

Fix nhanh: mở dashboard 9router → kiểm tra combo → disable provider đang lỗi → hoặc đổi model mặc định của agent sang `gemini/gemini-2.5-flash`.

## Bot leak reasoning / chain-of-thought ra reply

Xảy ra khi dùng combo có model reasoning (vd qwen-with-thinking) mà không strip thinking tag.

Fix: trong `openclaw.json`, đổi model Jessica sang `9router/gemini/gemini-2.5-flash`:

```json
"agents": { "chat": { "model": "9router/gemini/gemini-2.5-flash" } }
```

Restart `ai-bot`.

## TTS không tắt được

`tts.auto` short-circuit `tts.enabled` trong gating. Phải set **cả hai**:

```json
"tts": { "enabled": false, "auto": "off" }
```

Example config đã set đúng sẵn.

## Xem log theo service

```bash
./scripts/logs.sh ai-bot
./scripts/logs.sh 9router
./scripts/logs.sh zalo
./scripts/logs.sh nginx
./scripts/logs.sh             # all
```

## Reset hoàn toàn (mất data)

```bash
docker compose down -v
./install.sh
```
