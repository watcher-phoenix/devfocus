FROM node:22-slim

WORKDIR /app

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Frontend deps + build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Backend source
COPY backend/ ./backend/

# Create data directory
RUN mkdir -p /data

EXPOSE 3001
CMD ["node", "backend/start.js"]
