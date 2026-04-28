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
from backend.executor import SSHExecutor, async_run, async_test_connection

router = APIRouter(prefix="/api/targets", tags=["targets"])


class TargetCreate(BaseModel):
    name: str
    host: str
    port: int = 22
    username: str
    key_path: str


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    key_path: Optional[str] = None


def _make_executor(target: Target) -> SSHExecutor:
    return SSHExecutor(
        host=target.host,
        username=target.username,
        key_path=target.key_path,
        port=target.port,
    )


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
