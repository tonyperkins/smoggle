"""
routers/snapshots.py — Save, restore, and delete toggle state snapshots.

Snapshot state_json is a dict of {toggle_id: "on"|"off"|"unknown"}.
Restore applies sequentially — never parallel launchctl calls.
"""
import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from backend.database import get_session, Target, Snapshot, ToggleHistory
from backend.executor import SSHExecutor, async_run
from backend.toggles_registry import TOGGLES, TOGGLES_BY_ID

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


class SnapshotCreate(BaseModel):
    target_id: int
    name: str


def _make_executor(target: Target) -> SSHExecutor:
    return SSHExecutor(
        host=target.host,
        username=target.username,
        key_path=target.key_path,
        port=target.port,
    )


@router.get("")
async def list_snapshots(target: int, session: Session = Depends(get_session)):
    return session.exec(
        select(Snapshot).where(Snapshot.target_id == target).order_by(Snapshot.created_at.desc())
    ).all()


@router.post("", status_code=201)
async def create_snapshot(body: SnapshotCreate, session: Session = Depends(get_session)):
    """Read all toggle states via SSH and persist as a named snapshot."""
    tgt = session.get(Target, body.target_id)
    if not tgt:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(tgt)

    # Read all toggle states concurrently (read-only, safe to parallelize)
    async def fetch_state(toggle):
        stdout, _, _ = await async_run(executor, toggle["cmd_status"])
        val = stdout.strip()
        return toggle["id"], ("on" if val == "1" else "off" if val == "0" else "unknown")

    pairs = await asyncio.gather(*[fetch_state(t) for t in TOGGLES])
    state_dict = dict(pairs)

    snapshot = Snapshot(
        target_id=body.target_id,
        name=body.name,
        state_json=json.dumps(state_dict),
        created_at=datetime.utcnow(),
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot


@router.post("/{snapshot_id}/restore")
async def restore_snapshot(snapshot_id: int, session: Session = Depends(get_session)):
    """Restore toggle states from a snapshot sequentially."""
    snapshot = session.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    tgt = session.get(Target, snapshot.target_id)
    if not tgt:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(tgt)
    state_dict: dict = json.loads(snapshot.state_json)
    results = []

    # Sequential restore — never parallel launchctl calls
    for toggle_id, desired_state in state_dict.items():
        toggle = TOGGLES_BY_ID.get(toggle_id)
        if not toggle or desired_state == "unknown":
            continue

        cmd = toggle["cmd_on"] if desired_state == "on" else toggle["cmd_off"]
        _, stderr, exit_code = await async_run(executor, cmd)
        success = exit_code == 0

        history = ToggleHistory(
            target_id=snapshot.target_id,
            toggle_id=toggle_id,
            old_state=None,
            new_state=desired_state,
            profile=f"snapshot:{snapshot.name}",
            success=success,
            stderr=stderr if not success else None,
            timestamp=datetime.utcnow(),
        )
        session.add(history)
        results.append({"toggle_id": toggle_id, "new_state": desired_state, "success": success})

    tgt.last_seen = datetime.utcnow()
    session.add(tgt)
    session.commit()

    return {"snapshot_id": snapshot_id, "name": snapshot.name, "results": results}


@router.delete("/{snapshot_id}", status_code=204)
async def delete_snapshot(snapshot_id: int, session: Session = Depends(get_session)):
    snapshot = session.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    session.delete(snapshot)
    session.commit()
