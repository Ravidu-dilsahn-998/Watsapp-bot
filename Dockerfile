# IP DILSAHN - WhatsApp Bot
# ffmpeg + libvips are included so stickers and downloads work out of the box.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    TZ=Asia/Colombo \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# persistent session + data (mount a volume here on your host if possible)
VOLUME ["/app/auth", "/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "index.js"]
