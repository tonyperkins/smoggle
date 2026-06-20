"""
routers/profiles.py — Profile application with sequential toggle execution.

Toggles are applied one at a time (never in parallel) to avoid race conditions
with launchctl. Hyper profile requires confirm='HYPER' in the request body.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from backend.database import get_session, Target, ToggleHistory
from backend.executor import build_executor as _make_executor, async_run
from backend.toggles_registry import TOGGLES_BY_ID
from backend.profiles_registry import PROFILES, PROFILE_META
from backend.helper import run_toggle_cmd
from backend.auth import require_auth

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class ApplyProfileBody(BaseModel):
    target_id: int
    confirm: Optional[str] = None


@router.post("/{name}/apply")
async def apply_profile(
    name: str,
    body: ApplyProfileBody,
    session: Session = Depends(get_session),
    actor: str = Depends(require_auth),
):
    """
    Apply a named profile sequentially to the target Mac.
    - 'default' restores every toggle to its default_state.
    - 'hyper' requires confirm='HYPER'.
    Returns per-toggle results list.
    """
    if name not in PROFILES:
        raise HTTPException(status_code=404, detail=f"Unknown profile: {name}")

    meta = PROFILE_META[name]

    # Enforce Hyper confirmation
    if meta["confirm_word"] and body.confirm != meta["confirm_word"]:
        raise HTTPException(
            status_code=400,
            detail=f"Hyper profile requires confirm='{meta['confirm_word']}'",
        )

    tgt = session.get(Target, body.target_id)
    if not tgt:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(tgt)

    # Build the list of (toggle, desired_state) pairs
    if name == "default":
        # Restore every toggle to its Apple default_state
        work = [(t, t["default_state"]) for t in TOGGLES_BY_ID.values()]
    else:
        toggle_ids = PROFILES[name]
        # Non-default profiles turn their toggles OFF (disable background services)
        # High Power Mode (default_state=off) is turned ON when in a performance profile
        work = []
        for tid in toggle_ids:
            toggle = TOGGLES_BY_ID[tid]
            # If default is "off" (e.g. high_power_mode), enabling the profile turns it ON
            desired = "on" if toggle["default_state"] == "off" else "off"
            work.append((toggle, desired))

    results = []

    # Sequential apply — never parallel launchctl calls
    for toggle, desired_state in work:
        # Skip toggles the hardware doesn't support (e.g. high_power_mode on MacBook Air)
        if toggle.get("cmd_supported"):
            chk_out, _, _ = await async_run(executor, toggle["cmd_supported"])
            chk_lines = [ln.strip().strip("\r") for ln in chk_out.splitlines() if ln.strip()]
            if (chk_lines[-1] if chk_lines else "") != "1":
                results.append({
                    "toggle_id": toggle["id"],
                    "name": toggle["name"],
                    "old_state": "unsupported",
                    "new_state": "unsupported",
                    "success": True,
                    "skipped": True,
                    "stderr": None,
                })
                continue

        # Read old state — use last non-empty line (handles multi-line cmd_status output)
        old_stdout, _, _ = await run_toggle_cmd(executor, toggle, "status")
        old_lines = [ln.strip().strip("\r") for ln in old_stdout.splitlines() if ln.strip()]
        old_val = old_lines[-1] if old_lines else ""
        old_state = "on" if old_val == "1" else "off" if old_val == "0" else "unknown"

        stdout, stderr, exit_code = await run_toggle_cmd(executor, toggle, desired_state)

        # Verify by re-reading state — some tools (e.g. mdutil) exit non-zero even on success
        new_stdout, _, _ = await run_toggle_cmd(executor, toggle, "status")
        new_lines = [ln.strip().strip("\r") for ln in new_stdout.splitlines() if ln.strip()]
        new_val = new_lines[-1] if new_lines else ""
        actual_state = "on" if new_val == "1" else "off" if new_val == "0" else "unknown"
        success = (actual_state == desired_state) or (exit_code == 0 and actual_state not in ("unknown", "unsupported"))

        history = ToggleHistory(
            target_id=body.target_id,
            toggle_id=toggle["id"],
            old_state=old_state,
            new_state=desired_state,
            profile=name,
            success=success,
            stderr=stderr or None,
            actor=actor,
            timestamp=datetime.utcnow(),
        )
        session.add(history)

        results.append({
            "toggle_id": toggle["id"],
            "name": toggle["name"],
            "old_state": old_state,
            "new_state": desired_state,
            "success": success,
            "skipped": False,
            "stderr": stderr or None,
        })

    # Update last_seen
    tgt.last_seen = datetime.utcnow()
    session.add(tgt)
    session.commit()

    return {"profile": name, "results": results}
