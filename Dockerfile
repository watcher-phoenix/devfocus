FROM node:22-slim

WORKDIR /app

# sqlite3 needs build tools for native compilation
# Litestream for continuous SQLite backup
RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*
RUN wget -q https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz \
  && tar -xzf litestream-v0.3.13-linux-amd64.tar.gz -C /usr/local/bin \
  && rm litestream-v0.3.13-linux-amd64.tar.gz

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Frontend deps + build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build && rm -rf node_modules

# Backend source
COPY backend/ ./backend/

# Litestream config + entrypoint
COPY litestream.yml /etc/litestream.yml
COPY scripts/entrypoint.sh ./scripts/

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
EXPOSE 3001
CMD ["./scripts/entrypoint.sh"]
