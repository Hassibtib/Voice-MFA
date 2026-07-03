# ============================================================
#  audit_service.py — Structured audit logging to the DB
# ============================================================

from typing import Optional
from sqlalchemy.orm import Session
from ..models import AuditLog


def log_event(
    db: Session,
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """Write an audit log entry to the database."""
    entry = AuditLog(
        user_id=user_id,     # already a string (GUID type)
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details or {},
    )
    db.add(entry)
    db.commit()
