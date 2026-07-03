# ============================================================
#  routes/audit.py — Audit log viewer
# ============================================================

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..dependencies import get_current_user
from ..models import AuditLog
from ..schemas import AuditLogEntry, AuditLogListResponse

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("/logs", response_model=AuditLogListResponse)
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return recent audit log entries for the authenticated user."""
    user_id = current_user["sub"]

    total = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .count()
    )
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(desc(AuditLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return AuditLogListResponse(
        logs=[
            AuditLogEntry(
                id=str(log.id),
                event_type=log.event_type,
                ip_address=log.ip_address,
                details=log.details,
                created_at=log.created_at,
            )
            for log in logs
        ],
        total=total,
    )
