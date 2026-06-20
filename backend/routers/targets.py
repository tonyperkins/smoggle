"""
routers/targets.py — CRUD for target Macs.
On create: attempts SSH connection to auto-detect macOS version.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from backend.database import get_session, Target
from backend.executor import build_executor as _make_executor, async_run, async_test_connection

router = APIRouter(prefix="/api/targets", tags=["targets"])


class TargetCreate(BaseModel):
    name: str
    host: str
    port: int = 22
    username: str


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None




@router.get("")
async def list_targets(session: Session = Depends(get_session)):
    return session.exec(select(Target)).all()


@router.post("", status_code=201)
async def create_target(body: TargetCreate, session: Session = Depends(get_session)):
    target = Target(**body.dict())
    session.add(target)
    session.commit()
    session.refresh(target)

    # Auto-detect macOS version — best effort, non-fatal
    try:
        executor = _make_executor(target)
        stdout, _, code = await async_run(executor, "sw_vers -productVersion")
        if code == 0 and stdout.strip():
            target.macos_version = stdout.strip()
        # Pin the host key on first contact (trust-on-first-use)
        if executor.captured_fingerprint and not target.host_key_fingerprint:
            target.host_key_fingerprint = executor.captured_fingerprint
        target.last_seen = datetime.utcnow()
        session.add(target)
        session.commit()
        session.refresh(target)
    except Exception:
        pass

    return target


@router.patch("/{target_id}")
async def update_target(target_id: int, body: TargetUpdate, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    for field, value in body.dict(exclude_none=True).items():
        setattr(target, field, value)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


@router.delete("/{target_id}", status_code=204)
async def delete_target(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    session.delete(target)
    session.commit()


@router.post("/{target_id}/disconnect", status_code=200)
async def disconnect_target(target_id: int, session: Session = Depends(get_session)):
    """Close the cached SSH connection for this target. The next SSH action will reconnect."""
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    executor = _make_executor(target)
    executor.close()
    return {"ok": True, "target_id": target_id}


# Processes that must never be killable from the UI — system-critical daemons
_PROTECTED_PROCS = {
    "kernel_task", "launchd", "WindowServer", "loginwindow", "sshd",
    "mds", "mds_stores", "mDNSResponder", "configd", "coreaudiod",
    "coreaudiolicensed", "opendirectoryd", "diskarbitrationd",
    "securityd", "trustd", "logd", "notifyd", "watchdogd",
    "SystemUIServer", "Dock", "Finder",
}


@router.post("/{target_id}/kill/{pid}", status_code=200)
async def kill_process(
    target_id: int,
    pid: int,
    force: bool = False,
    session: Session = Depends(get_session),
):
    """Send SIGTERM (or SIGKILL if force=true) to a process on the target Mac."""
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(target)

    # Resolve process name for the protection check
    name_out, _, _ = await async_run(executor, f"ps -p {pid} -o comm= 2>/dev/null")
    proc_name = name_out.strip().split("/")[-1]

    if proc_name in _PROTECTED_PROCS:
        raise HTTPException(status_code=403, detail=f"Process '{proc_name}' is protected and cannot be killed")

    sig = "SIGKILL" if force else "SIGTERM"
    sig_flag = f"-{sig}"

    safe_name = proc_name.replace("'", "'\\''")

    if not force:
        # For GUI apps, try osascript quit first — respects app lifecycle properly.
        # Falls back to pkill SIGTERM if osascript fails (non-GUI / no bundle).
        osa_name = proc_name.replace('"', '\\"')
        cmd = (
            f'osascript -e \'tell application "{osa_name}" to quit\' 2>/dev/null'
            f" || pkill -SIGTERM -x '{safe_name}' 2>/dev/null"
            f"; echo __exit__$?"
        )
    else:
        # Force: SIGKILL — cannot be caught or ignored
        cmd = f"pkill -SIGKILL -x '{safe_name}' 2>&1; echo __exit__$?"

    stdout, stderr, code = await async_run(executor, cmd)

    exit_code = 0
    output_lines = []
    for line in stdout.splitlines():
        if line.startswith("__exit__"):
            try:
                exit_code = int(line.split("__exit__", 1)[1])
            except ValueError:
                pass
        else:
            output_lines.append(line)
    output = "\n".join(output_lines).strip()

    # pkill exit 1 = no matching process found (already dead is fine)
    if exit_code not in (0, 1):
        raise HTTPException(
            status_code=500,
            detail=output or stderr.strip() or f"pkill exited {exit_code}"
        )

    return {"ok": True, "pid": pid, "signal": sig, "process": proc_name}
