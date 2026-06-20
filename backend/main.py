"""
main.py — FastAPI application entry point for Smoggle.
"""
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.database import init_db
from backend import ssh_identity
from backend import auth
from backend.auth import require_auth
from backend.routers import targets, toggles, profiles, snapshots, status, setup, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ssh_identity.ensure_identity()
    auth.ensure_credentials()
    yield


app = FastAPI(
    title="Smoggle",
    description="AI Performance Toggle Dashboard for macOS Apple Silicon",
    version="1.0.0",
    lifespan=lifespan,
)

# The SPA is served same-origin, so no cross-origin access is needed by default.
# SMOGGLE_ORIGINS (comma-separated) opts specific origins in; credentials are
# only allowed alongside an explicit allowlist (never with a wildcard).
_origins = [o.strip() for o in os.getenv("SMOGGLE_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# All API routers require Basic Auth. /health, the static SPA, and the
# enrollment endpoints (setup.public_router — fetched on the target Mac with no
# dashboard credentials) stay open.
_auth = [Depends(require_auth)]
app.include_router(setup.public_router)
app.include_router(targets.router, dependencies=_auth)
app.include_router(toggles.router, dependencies=_auth)
app.include_router(profiles.router, dependencies=_auth)
app.include_router(snapshots.router, dependencies=_auth)
app.include_router(status.router, dependencies=_auth)
app.include_router(setup.router, dependencies=_auth)
app.include_router(history.router, dependencies=_auth)


@app.get("/health")
def health():
    return {"status": "ok", "service": "smoggle"}


# STATIC_DIR env var is set in the Dockerfile to /app/frontend/dist.
# Falls back to the local dev path (../../frontend/dist relative to this file).
_default_static = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
static_dir = os.environ.get("STATIC_DIR", _default_static)
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
