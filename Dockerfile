# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install deps first (layer-cached separately from source)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --prefer-offline

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + static files ────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# curl for healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps (layer-cached separately from app code)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY backend/ ./backend/

# React build output from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Persistent data directory
RUN mkdir -p /app/data

# Environment
ENV DATABASE_URL=sqlite:////app/data/smoggle.db
ENV STATIC_DIR=/app/frontend/dist
ENV PYTHONPATH=/app

EXPOSE 7420

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7420"]
