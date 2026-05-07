FROM node:22-slim

WORKDIR /app

# sqlite3 needs build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

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

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "backend/start.js"]
