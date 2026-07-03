from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .services.auth_service import decode_token

security = HTTPBearer()


def get_current_pre_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Accept either a pre-auth or full-session token.
    Used during the MFA flow (voice verify, TOTP verify)
    and also for enrollment actions.
    """
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    if payload.get("type") not in ("pre_auth", "full_session"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token type",
        )
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Require a full-session token.
    Used for protected dashboard/settings endpoints.
    """
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    if payload.get("type") != "full_session":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Full authentication required",
        )
    return payload
