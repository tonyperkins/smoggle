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

# curl for healthcheck; gosu to drop privileges from the entrypoint
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gosu \
    && rm -rf /var/lib/apt/lists/*

# Unprivileged runtime user — the app drops to this via the entrypoint
RUN useradd --system --create-home --shell /usr/sbin/nologin smoggle

# Python deps (layer-cached separately from app code)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY backend/ ./backend/

# React build output from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Persistent data directory, owned by the runtime user (fresh volumes inherit this)
RUN mkdir -p /app/data && chown -R smoggle:smoggle /app/data

# Entrypoint fixes volume ownership then drops to the smoggle user
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

# Environment
ENV DATABASE_URL=sqlite:////app/data/smoggle.db
ENV STATIC_DIR=/app/frontend/dist
ENV PYTHONPATH=/app

EXPOSE 7420

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7420"]
