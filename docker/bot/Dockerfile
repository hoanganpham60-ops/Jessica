FROM node:22-slim

RUN apt-get update && \
    apt-get install -y git curl socat ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

# Patch: buffer Zalo WS file_done events to fix race condition in async upload.
COPY patch-openclaw.js /tmp/patch-openclaw.js
RUN node /tmp/patch-openclaw.js || true

# Entrypoint seeds openclaw.json on first run then launches gateway
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /root/.openclaw

ENTRYPOINT ["/entrypoint.sh"]
