FROM node:20-slim

RUN apt-get update && \
    apt-get install -y ca-certificates curl && \
    curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.5.1.tgz \
    | tar -xz -C /usr/local/bin --strip-components=1 docker/docker && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js
COPY views ./views
COPY public ./public

EXPOSE 3000
CMD ["node", "server.js"]
