# ============================================================
#  auth_service.py — Password hashing, JWT creation/validation
# ============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from ..config import settings


# ── Password ─────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT tokens ───────────────────────────────────────────────

def create_pre_auth_token(user_id: str, username: str) -> str:
    """Short-lived token issued after password verification."""
    payload = {
        "sub": user_id,
        "username": username,
        "type": "pre_auth",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_PRE_AUTH_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_full_session_token(user_id: str, username: str) -> str:
    """Full-session token issued after all MFA factors pass."""
    payload = {
        "sub": user_id,
        "username": username,
        "type": "full_session",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_FULL_SESSION_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns None on any error."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ── Backup codes ─────────────────────────────────────────────

def hash_backup_code(code: str) -> str:
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_backup_code(code: str, hashed: str) -> bool:
    return bcrypt.checkpw(code.encode("utf-8"), hashed.encode("utf-8"))
