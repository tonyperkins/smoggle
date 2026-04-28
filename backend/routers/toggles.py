"""
routers/toggles.py — Live toggle state reads and apply with history logging.

All SSH calls go through async_run() to avoid blocking the event loop.
"""
import asyncio
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from backend.database import get_session, Target, ToggleHistory
from backend.executor import SSHExecutor, async_run
from backend.toggles_registry import TOGGLES, TOGGLES_BY_ID

router = APIRouter(prefix="/api/toggles", tags=["toggles"])


class ApplyToggleBody(BaseModel):
    target_id: int
    state: Literal["on", "off"]


def _get_target_or_404(target_id: int, session: Session) -> Target:
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return target


def _make_executor(target: Target) -> SSHExecutor:
    return SSHExecutor(
        host=target.host,
        username=target.username,
        key_path=target.key_path,
        port=target.port,
    )


async def _read_live_state(executor: SSHExecutor, toggle: dict) -> str:
    """Run cmd_status; returns 'on' or 'off'. Defaults to 'unknown' on error.

    Accepts multi-line output — checks the last non-empty line for '1' or '0'.
    This handles compound commands like:
        tmutil status ... | grep ... && echo 1 || echo 0
    which may emit extra lines before the final echo.
    """
    try:
        stdout, stderr, code = await async_run(executor, toggle["cmd_status"])
    except Exception:
        return "unknown"

    # Find the last non-empty line (strips CR from Windows-style SSH output too)
    lines = [ln.strip().strip("\r") for ln in stdout.splitlines() if ln.strip()]
    val = lines[-1] if lines else ""

    if val == "1":
        return "on"
    if val == "0":
        return "off"
    return "unknown"


@router.get("")
async def list_toggles(target: int, session: Session = Depends(get_session)):
    """Return all toggles with live state for the given target."""
    tgt = _get_target_or_404(target, session)
    executor = _make_executor(tgt)

    # Read all toggle states concurrently — they are independent read-only cmds
    async def fetch(toggle):
        live_state = await _read_live_state(executor, toggle)
        return {**toggle, "live_state": live_state}

    results = await asyncio.gather(*[fetch(t) for t in TOGGLES])

    # Update last_seen
    tgt.last_seen = datetime.utcnow()
    session.add(tgt)
    session.commit()

    return results


@router.get("/{toggle_id}/status")
async def get_toggle_status(toggle_id: str, target: int, session: Session = Depends(get_session)):
    """Return live state of a single toggle."""
    if toggle_id not in TOGGLES_BY_ID:
        raise HTTPException(status_code=404, detail="Toggle not found")
    tgt = _get_target_or_404(target, session)
    executor = _make_executor(tgt)
    toggle = TOGGLES_BY_ID[toggle_id]
    live_state = await _read_live_state(executor, toggle)
    return {**toggle, "live_state": live_state}


@router.post("/{toggle_id}/apply")
async def apply_toggle(
    toggle_id: str,
    body: ApplyToggleBody,
    session: Session = Depends(get_session),
):
    """Apply a toggle state change via SSH and record to history."""
    if toggle_id not in TOGGLES_BY_ID:
        raise HTTPException(status_code=404, detail="Toggle not found")

    tgt = _get_target_or_404(body.target_id, session)
    executor = _make_executor(tgt)
    toggle = TOGGLES_BY_ID[toggle_id]

    # Read current state before applying
    old_state = await _read_live_state(executor, toggle)

    cmd = toggle["cmd_on"] if body.state == "on" else toggle["cmd_off"]
    stdout, stderr, exit_code = await async_run(executor, cmd)
    success = exit_code == 0

    # Record to history
    history = ToggleHistory(
        target_id=body.target_id,
        toggle_id=toggle_id,
        old_state=old_state,
        new_state=body.state,
        success=success,
        stderr=stderr if not success else None,
        timestamp=datetime.utcnow(),
    )
    session.add(history)

    # Update last_seen
    tgt.last_seen = datetime.utcnow()
    session.add(tgt)
    session.commit()

    if not success:
        raise HTTPException(
            status_code=500,
            detail={"message": "Toggle command failed", "stderr": stderr, "toggle_id": toggle_id},
        )

    # Re-read live state to confirm
    live_state = await _read_live_state(executor, toggle)
    return {**toggle, "live_state": live_state, "old_state": old_state}
