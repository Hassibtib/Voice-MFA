# ============================================================
#  routes/auth.py — Registration, login, MFA verification
# ============================================================

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_pre_auth_user, get_current_user
from ..models import User
from ..schemas import (
    RegisterRequest, RegisterResponse,
    LoginRequest, LoginResponse,
    VerifyResponse,
    TOTPVerifyRequest, BackupCodeVerifyRequest,
    UserResponse,
)
from ..services import auth_service, audit_service, voice_service, challenge_service
from ..services.totp_service import verify_code as totp_verify_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Register ─────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(400, "Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(400, "Email already registered")

    user = User(
        username=req.username,
        email=req.email,
        password_hash=auth_service.hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit_service.log_event(
        db, "REGISTER", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return RegisterResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        message="Registration successful",
    )


# ── Login (password step) ───────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not auth_service.verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    if not user.is_active:
        raise HTTPException(403, "Account deactivated")

    # Check lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds())
        raise HTTPException(423, f"Account locked. Try again in {remaining} seconds.")

    # Reset failed attempts on successful password
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()

    token = auth_service.create_pre_auth_token(str(user.id), user.username)

    audit_service.log_event(
        db, "LOGIN_PASSWORD", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    # If no MFA is configured, issue full session directly
    if not user.is_voice_enrolled and not user.is_totp_enabled:
        full_token = auth_service.create_full_session_token(str(user.id), user.username)
        return LoginResponse(
            pre_auth_token=full_token,
            requires_voice=False,
            requires_totp=False,
            message="No MFA configured. Full access granted.",
        )

    return LoginResponse(
        pre_auth_token=token,
        requires_voice=user.is_voice_enrolled,
        requires_totp=user.is_totp_enabled,
        message="Password verified. Complete MFA to continue.",
    )


# ── Voice verification ──────────────────────────────────────

@router.post("/verify-voice", response_model=VerifyResponse)
async def verify_voice(
    request: Request,
    challenge_id: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_pre_auth_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Check lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds())
        raise HTTPException(423, f"Account locked. Try again in {remaining}s.")

    # Validate challenge (anti-replay)
    phrase = challenge_service.validate_and_consume(challenge_id)
    if phrase is None:
        raise HTTPException(400, "Challenge expired or already used. Request a new one.")

    # Process audio
    audio_bytes = await audio.read()
    try:
        audio_np, sr = voice_service.audio_bytes_to_numpy(audio_bytes)
    except Exception:
        raise HTTPException(400, "Invalid audio file")

    if not voice_service.is_audio_valid(audio_np):
        raise HTTPException(400, "Audio too quiet or silent. Please try again.")

    # Get stored embeddings
    stored = [vp.embedding for vp in user.voice_profiles]
    if not stored:
        raise HTTPException(400, "No voice enrollment found. Please enroll first.")

    # Verify speaker
    is_match, score = voice_service.verify_voice(
        audio_np, sr, stored, settings.SIMILARITY_THRESHOLD
    )

    if is_match:
        user.failed_attempts = 0
        db.commit()

        audit_service.log_event(
            db, "VOICE_VERIFY_SUCCESS", str(user.id),
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
            {"score": score, "threshold": settings.SIMILARITY_THRESHOLD, "challenge": phrase},
        )

        # If TOTP is also required, don't issue full session yet
        if user.is_totp_enabled:
            return VerifyResponse(
                success=True, token=None, score=score,
                message="Voice verified. TOTP verification required.",
            )

        # All factors passed → full session
        full_token = auth_service.create_full_session_token(str(user.id), user.username)
        return VerifyResponse(
            success=True, token=full_token, score=score,
            message="Voice verified. Full access granted.",
        )

    # ── Failed ───────────────────────────────────────────────
    user.failed_attempts += 1
    remaining = settings.MAX_FAILED_ATTEMPTS - user.failed_attempts

    if user.failed_attempts >= settings.MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(
            minutes=settings.LOCKOUT_DURATION_MINUTES
        )
        db.commit()
        audit_service.log_event(
            db, "ACCOUNT_LOCKED", str(user.id),
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
            {"failed_attempts": user.failed_attempts},
        )
        raise HTTPException(
            423,
            f"Too many failed attempts. Account locked for {settings.LOCKOUT_DURATION_MINUTES} minutes.",
        )

    db.commit()
    audit_service.log_event(
        db, "VOICE_VERIFY_FAILED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        {"score": score, "threshold": settings.SIMILARITY_THRESHOLD, "attempts": user.failed_attempts},
    )

    return VerifyResponse(
        success=False, score=score,
        attempts_remaining=remaining,
        message=f"Voice verification failed (score: {score}). {remaining} attempt(s) remaining.",
    )


# ── TOTP verification (during login) ────────────────────────

@router.post("/verify-totp", response_model=VerifyResponse)
def verify_totp(
    req: TOTPVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_pre_auth_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user or not user.totp_secret:
        raise HTTPException(400, "TOTP not configured for this account")

    if totp_verify_code(user.totp_secret, req.code):
        full_token = auth_service.create_full_session_token(str(user.id), user.username)
        audit_service.log_event(
            db, "TOTP_VERIFY_SUCCESS", str(user.id),
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
        )
        return VerifyResponse(
            success=True, token=full_token,
            message="TOTP verified. Full access granted.",
        )

    raise HTTPException(401, "Invalid TOTP code")


# ── Backup code verification ────────────────────────────────

@router.post("/verify-backup-code", response_model=VerifyResponse)
def verify_backup_code(
    req: BackupCodeVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_pre_auth_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    for bc in user.backup_codes:
        if not bc.is_used and auth_service.verify_backup_code(req.code.upper(), bc.code_hash):
            bc.is_used = True
            bc.used_at = datetime.now(timezone.utc)
            db.commit()

            full_token = auth_service.create_full_session_token(str(user.id), user.username)
            audit_service.log_event(
                db, "BACKUP_CODE_USED", str(user.id),
                request.client.host if request.client else None,
                request.headers.get("user-agent"),
            )
            return VerifyResponse(
                success=True, token=full_token,
                message="Backup code accepted. Full access granted.",
            )

    raise HTTPException(401, "Invalid or already-used backup code")


# ── Current user info ────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        is_voice_enrolled=user.is_voice_enrolled,
        is_totp_enabled=user.is_totp_enabled,
        created_at=user.created_at,
    )
