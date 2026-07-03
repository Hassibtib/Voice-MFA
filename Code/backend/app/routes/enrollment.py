# ============================================================
#  routes/enrollment.py — Voice enrollment management
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user, get_current_pre_auth_user
from ..models import User, VoiceProfile
from ..schemas import (
    EnrollmentStatusResponse,
    EnrollmentSampleResponse,
    EnrollmentCompleteResponse,
)
from ..services import voice_service, audit_service

router = APIRouter(prefix="/api/enrollment/voice", tags=["Voice Enrollment"])


# ── Get enrollment status ────────────────────────────────────

@router.get("/status", response_model=EnrollmentStatusResponse)
def enrollment_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_pre_auth_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    count = db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).count()
    return EnrollmentStatusResponse(
        is_enrolled=user.is_voice_enrolled,
        samples_count=count,
        min_required=settings.MIN_ENROLLMENT_SAMPLES,
        max_allowed=settings.MAX_ENROLLMENT_SAMPLES,
    )


# ── Upload a single voice sample ─────────────────────────────

@router.post("/sample", response_model=EnrollmentSampleResponse)
async def upload_sample(
    request: Request,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Check max samples
    existing_count = (
        db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).count()
    )
    if existing_count >= settings.MAX_ENROLLMENT_SAMPLES:
        raise HTTPException(
            400,
            f"Maximum {settings.MAX_ENROLLMENT_SAMPLES} samples allowed. "
            f"Delete enrollment to start over.",
        )

    # Process audio
    audio_bytes = await audio.read()
    try:
        audio_np, sr = voice_service.audio_bytes_to_numpy(audio_bytes)
    except Exception:
        raise HTTPException(400, "Invalid audio file. Please upload a WAV file.")

    if not voice_service.is_audio_valid(audio_np):
        raise HTTPException(400, "Audio too quiet or silent. Please record again.")

    # Extract embedding and store
    embedding = voice_service.embed_audio(audio_np, sr)
    emb_bytes = voice_service.embedding_to_bytes(embedding)

    sample_number = existing_count + 1
    profile = VoiceProfile(
        user_id=user.id,
        embedding=emb_bytes,
        sample_number=sample_number,
    )
    db.add(profile)
    db.commit()

    audit_service.log_event(
        db, "VOICE_SAMPLE_UPLOADED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        {"sample_number": sample_number},
    )

    return EnrollmentSampleResponse(
        sample_number=sample_number,
        total_samples=sample_number,
        message=f"Sample {sample_number} uploaded successfully.",
    )


# ── Complete enrollment ──────────────────────────────────────

@router.post("/complete", response_model=EnrollmentCompleteResponse)
def complete_enrollment(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    count = db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).count()
    if count < settings.MIN_ENROLLMENT_SAMPLES:
        raise HTTPException(
            400,
            f"Need at least {settings.MIN_ENROLLMENT_SAMPLES} samples. "
            f"You have {count}.",
        )

    user.is_voice_enrolled = True
    db.commit()

    audit_service.log_event(
        db, "VOICE_ENROLLMENT_COMPLETE", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        {"samples": count},
    )

    return EnrollmentCompleteResponse(
        success=True,
        samples_used=count,
        message=f"Voice enrollment complete with {count} samples. "
                f"Voice verification is now required for future logins.",
    )


# ── Delete enrollment (re-enroll) ────────────────────────────

@router.delete("")
def delete_enrollment(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).delete()
    user.is_voice_enrolled = False
    db.commit()

    audit_service.log_event(
        db, "VOICE_ENROLLMENT_DELETED", str(user.id),
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return {"success": True, "message": "Voice enrollment deleted. You can re-enroll."}
