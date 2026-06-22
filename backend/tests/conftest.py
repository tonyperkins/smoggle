"""
conftest.py — shared pytest fixtures for Smoggle backend tests.

Sets up a temp data dir with known auth credentials before any backend modules
import, then provides a TestClient with a clean DB per-test.
"""
import os
import base64
import tempfile
from pathlib import Path

import pytest
import bcrypt


# ── Session-scoped: set env vars BEFORE any backend module is imported ──────

_tmp_dir = tempfile.mkdtemp(prefix="smoggle-test-")
_data_dir = Path(_tmp_dir) / "data"
_data_dir.mkdir()

os.environ["DATABASE_URL"] = f"sqlite:///{_data_dir / 'test.db'}"
os.environ["SMOGGLE_KEY_PATH"] = str(_data_dir / "id_smoggle")
os.environ["SMOGGLE_AUTH_FILE"] = str(_data_dir / "auth")
os.environ["SMOGGLE_AUTH_USER"] = "admin"
_hashed = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode("utf-8")
os.environ["SMOGGLE_AUTH_PASSWORD_HASH"] = _hashed


@pytest.fixture()
def client():
    """TestClient with lifespan events triggered (DB init, key gen, auth).
    Drops and recreates all tables before each test for isolation."""
    from backend.main import app
    from backend.database import engine, init_db
    from sqlmodel import SQLModel

    # Drop and recreate tables for a clean slate
    SQLModel.metadata.drop_all(engine)
    init_db()

    with pytest.MonkeyPatch().context() as m:
        from fastapi.testclient import TestClient
        with TestClient(app) as c:
            yield c


@pytest.fixture()
def auth_headers():
    """Basic Auth headers for the test admin user."""
    cred = base64.b64encode(b"admin:testpass").decode("ascii")
    return {"Authorization": f"Basic {cred}"}
