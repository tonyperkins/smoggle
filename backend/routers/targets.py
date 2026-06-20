"""
routers/targets.py — CRUD for target Macs.
On create: attempts SSH connection to auto-detect macOS version.
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

from backend.database import get_session, Target
from backend.executor import build_executor as _make_executor, async_run, async_test_connection

router = APIRouter(prefix="/api/targets", tags=["targets"])

# Defense-in-depth: host/username are passed to paramiko as connection params
# (never shell-interpolated today), but constrain them to safe charsets so they
# can never become an injection vector if that ever changes.
_HOST_RE = re.compile(r"^[A-Za-z0-9.\-]+$")
_USERNAME_RE = re.compile(r"^[a-z_][a-z0-9_-]*$")


def _check_host(v: str) -> str:
    if not v or len(v) > 255 or not _HOST_RE.match(v):
        raise ValueError("host must be a hostname or IP (letters, digits, dots, hyphens)")
    return v


def _check_username(v: str) -> str:
    if len(v) > 32 or not _USERNAME_RE.match(v):
        raise ValueError("username must start with a letter/underscore and use [a-z0-9_-]")
    return v


def _check_port(v: int) -> int:
    if not (1 <= v <= 65535):
        raise ValueError("port must be between 1 and 65535")
    return v


class TargetCreate(BaseModel):
    name: str
    host: str
    port: int = 22
    username: str

    @field_validator("host")
    @classmethod
    def _v_host(cls, v):
        return _check_host(v)

    @field_validator("username")
    @classmethod
    def _v_user(cls, v):
        return _check_username(v)

    @field_validator("port")
    @classmethod
    def _v_port(cls, v):
        return _check_port(v)


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None

    @field_validator("host")
    @classmethod
    def _v_host(cls, v):
        return v if v is None else _check_host(v)

    @field_validator("username")
    @classmethod
    def _v_user(cls, v):
        return v if v is None else _check_username(v)

    @field_validator("port")
    @classmethod
    def _v_port(cls, v):
        return v if v is None else _check_port(v)




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
    sig_flag = "-KILL" if force else "-TERM"

    # Kill strictly by integer PID (FastAPI has already validated it as an int),
    # so the process name — sourced from remote `ps` output — is never
    # interpolated into a shell command. The name is used only for the
    # protection check above and the response.
    cmd = f"kill {sig_flag} {pid} 2>&1; echo __exit__$?"

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

    # kill exit 1 = no such process (already dead is fine)
    if exit_code not in (0, 1):
        raise HTTPException(
            status_code=500,
            detail=output or stderr.strip() or f"kill exited {exit_code}"
        )

    return {"ok": True, "pid": pid, "signal": sig, "process": proc_name}
