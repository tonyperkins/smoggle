"""
routers/history.py — Toggle change history log.

GET /api/history
  Query params:
    target_id  (int, required)
    toggle_id  (str, optional)  — filter to one toggle
    profile    (str, optional)  — filter by profile name
    limit      (int, default 100)
    offset     (int, default 0)
  Returns rows ordered by timestamp DESC, enriched with toggle_name.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import Optional, List

from backend.database import get_session, ToggleHistory
from backend.toggles_registry import TOGGLES_BY_ID

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def get_history(
    target_id: int,
    toggle_id: Optional[str] = None,
    profile: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    query = (
        select(ToggleHistory)
        .where(ToggleHistory.target_id == target_id)
    )

    if toggle_id:
        query = query.where(ToggleHistory.toggle_id == toggle_id)
    if profile:
        query = query.where(ToggleHistory.profile == profile)

    query = query.order_by(ToggleHistory.timestamp.desc()).offset(offset).limit(limit)

    rows = session.exec(query).all()

    return [
        {
            "id":          row.id,
            "toggle_id":   row.toggle_id,
            "toggle_name": TOGGLES_BY_ID.get(row.toggle_id, {}).get("name", row.toggle_id),
            "old_state":   row.old_state,
            "new_state":   row.new_state,
            "profile":     row.profile,
            "success":     row.success,
            "stderr":      row.stderr,
            "actor":       row.actor,
            "timestamp":   row.timestamp,
        }
        for row in rows
    ]
