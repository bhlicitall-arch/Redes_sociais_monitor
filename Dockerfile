# Dockerfile para Render
FROM node:20-alpine AS builder

WORKDIR /app

# Backend
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Frontend
COPY frontend/package*.json frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./frontend/
COPY frontend/src/ ./frontend/src/
COPY frontend/public/ ./frontend/public/
RUN cd frontend && npm ci && npm run build

# ============================================================
# Runtime
# ============================================================
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/start.js"]
