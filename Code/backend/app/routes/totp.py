# ============================================================
#  routes/totp.py — TOTP enrollment and management
# ============================================================

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, BackupCode
from ..schemas import (
    TOTPSetupResponse,
    TOTPVerifySetupRequest, TOTPVerifySetupResponse,
)
from ..services import totp_service, auth_service, audit_service

router = APIRouter(prefix="/api/totp", tags=["TOTP"])


# ── Begin TOTP setup ─────────────────────────────────────────

@router.post("/setup", response_model=TOTPSetupResponse)
def totp_setup(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.is_totp_enabled:
        raise HTTPException(400, "TOTP is already enabled. Disable it first to re-setup.")

    secret = totp_service.generate_secret()
    user.totp_secret = secret
    db.commit()

    uri = totp_service.provisioning_uri(secret, user.username)

    audit_service.log_event(
        db, "TOTP_SETUP_STARTED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return TOTPSetupResponse(
        secret=secret,
        provisioning_uri=uri,
        message="Scan the QR code with your authenticator app, then verify with a code.",
    )


# ── Verify and activate TOTP ────────────────────────────────

@router.post("/verify-setup", response_model=TOTPVerifySetupResponse)
def totp_verify_setup(
    req: TOTPVerifySetupRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user or not user.totp_secret:
        raise HTTPException(400, "Please start TOTP setup first")

    if not totp_service.verify_code(user.totp_secret, req.code):
        raise HTTPException(401, "Invalid code. Make sure your authenticator is synced.")

    # Enable TOTP
    user.is_totp_enabled = True

    # Generate backup codes
    codes = totp_service.generate_backup_codes()
    # Clear old backup codes
    db.query(BackupCode).filter(BackupCode.user_id == user.id).delete()
    for code in codes:
        bc = BackupCode(
            user_id=user.id,
            code_hash=auth_service.hash_backup_code(code),
        )
        db.add(bc)

    db.commit()

    audit_service.log_event(
        db, "TOTP_ENABLED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return TOTPVerifySetupResponse(
        success=True,
        backup_codes=codes,
        message="TOTP enabled! Save your backup codes — they won't be shown again.",
    )


# ── Disable TOTP ────────────────────────────────────────────

@router.post("/disable")
def totp_disable(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.is_totp_enabled = False
    user.totp_secret = None
    db.query(BackupCode).filter(BackupCode.user_id == user.id).delete()
    db.commit()

    audit_service.log_event(
        db, "TOTP_DISABLED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return {"success": True, "message": "TOTP has been disabled."}
