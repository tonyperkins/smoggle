"""
database.py — SQLModel models and database initialization.
"""
# TODO: Phase 2 — full implementation placeholder
from sqlmodel import SQLModel, Field, create_engine, Session
from sqlalchemy import inspect, text
from typing import Optional
from datetime import datetime
import os

_default_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "smoggle.db")
_default_db_dir = os.path.dirname(_default_db_path)
os.makedirs(_default_db_dir, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.abspath(_default_db_path)}")
engine = create_engine(DATABASE_URL, echo=False)


class Target(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    host: str
    port: int = 22
    username: str
    # Legacy column — the app now authenticates with its own managed identity
    # key (see ssh_identity.py), so this value is unused. Defaults to "" rather
    # than NULL so inserts satisfy the original NOT NULL constraint on DBs
    # created before enrollment existed (create_all won't alter the column).
    key_path: str = ""
    # Pinned SSH host-key fingerprint (SHA256:...). Captured trust-on-first-use
    # on the first successful connect; mismatches afterward are rejected.
    host_key_fingerprint: Optional[str] = None
    macos_version: Optional[str] = None
    last_seen: Optional[datetime] = None


class ToggleHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    target_id: int = Field(foreign_key="target.id")
    toggle_id: str
    old_state: Optional[str] = None
    new_state: str
    profile: Optional[str] = None
    success: bool = True
    stderr: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Snapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    target_id: int = Field(foreign_key="target.id")
    name: str
    state_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Additive columns introduced after the original schema. create_all() never
# ALTERs existing tables, so for pre-existing databases (persistent volume) we
# add any missing nullable columns by hand. ADD COLUMN is supported by both
# SQLite and Postgres. Keep entries here when adding new optional columns.
_ADDITIVE_COLUMNS = {
    "target": {
        "host_key_fingerprint": "VARCHAR",
    },
}


def _run_migrations():
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    for table, columns in _ADDITIVE_COLUMNS.items():
        if table not in existing_tables:
            continue  # create_all() made it fresh, already has the column
        present = {c["name"] for c in insp.get_columns(table)}
        for name, coltype in columns.items():
            if name not in present:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {coltype}"))


def init_db():
    """Create all tables, then apply additive column migrations."""
    SQLModel.metadata.create_all(engine)
    _run_migrations()


def get_session():
    with Session(engine) as session:
        yield session
