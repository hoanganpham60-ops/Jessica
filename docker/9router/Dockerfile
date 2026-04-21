FROM node:20-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Cài 9router từ npm (không còn phải mount source từ host)
RUN npm install -g 9router@latest

# 9router chạy ra data dir = $HOME/.9router
WORKDIR /data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
