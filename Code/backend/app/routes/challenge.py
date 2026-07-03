# ============================================================
#  routes/challenge.py — Challenge phrase endpoint
# ============================================================

from fastapi import APIRouter, Depends
from ..dependencies import get_current_pre_auth_user
from ..schemas import ChallengeResponse
from ..services.challenge_service import generate_challenge

router = APIRouter(prefix="/api/challenge", tags=["Challenge"])


@router.get("", response_model=ChallengeResponse)
def get_challenge(current_user: dict = Depends(get_current_pre_auth_user)):
    """
    Generate a fresh, unique challenge phrase for voice verification.
    The challenge ID is single-use and expires quickly (anti-replay).
    """
    challenge_id, phrase, expires_in = generate_challenge()
    return ChallengeResponse(
        challenge_id=challenge_id,
        phrase=phrase,
        expires_in=expires_in,
    )
