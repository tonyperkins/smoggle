"""
main.py — FastAPI application entry point for Smoggle.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.database import init_db
from backend import ssh_identity
from backend.routers import targets, toggles, profiles, snapshots, status, setup, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ssh_identity.ensure_identity()
    yield


app = FastAPI(
    title="Smoggle",
    description="AI Performance Toggle Dashboard for macOS Apple Silicon",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(targets.router)
app.include_router(toggles.router)
app.include_router(profiles.router)
app.include_router(snapshots.router)
app.include_router(status.router)
app.include_router(setup.router)
app.include_router(history.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "smoggle"}


# STATIC_DIR env var is set in the Dockerfile to /app/frontend/dist.
# Falls back to the local dev path (../../frontend/dist relative to this file).
_default_static = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
static_dir = os.environ.get("STATIC_DIR", _default_static)
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
