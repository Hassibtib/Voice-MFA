# ============================================================
#  totp_service.py — TOTP / backup-code helpers
# ============================================================

import secrets
from typing import List

import pyotp

from ..config import settings


def generate_secret() -> str:
    """Generate a new base32-encoded TOTP secret."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, username: str) -> str:
    """Return an otpauth:// URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=settings.TOTP_ISSUER)


def verify_code(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code (allows ±1 window)."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count: int | None = None) -> List[str]:
    """Generate a list of single-use backup codes."""
    n = count or settings.NUM_BACKUP_CODES
    return [secrets.token_hex(4).upper() for _ in range(n)]
