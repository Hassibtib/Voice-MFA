# ============================================================
#  schemas.py — Pydantic request/response models
# ============================================================

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

class RegisterResponse(BaseModel):
    id: str
    username: str
    email: str
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    pre_auth_token: str
    requires_voice: bool
    requires_totp: bool
    message: str

class VerifyResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str
    score: Optional[float] = None
    attempts_remaining: Optional[int] = None

class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

class BackupCodeVerifyRequest(BaseModel):
    code: str


# ── Challenge ────────────────────────────────────────────────

class ChallengeResponse(BaseModel):
    challenge_id: str
    phrase: str
    expires_in: int


# ── Enrollment ───────────────────────────────────────────────

class EnrollmentStatusResponse(BaseModel):
    is_enrolled: bool
    samples_count: int
    min_required: int
    max_allowed: int

class EnrollmentSampleResponse(BaseModel):
    sample_number: int
    total_samples: int
    message: str

class EnrollmentCompleteResponse(BaseModel):
    success: bool
    samples_used: int
    message: str


# ── TOTP ─────────────────────────────────────────────────────

class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    message: str

class TOTPVerifySetupRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

class TOTPVerifySetupResponse(BaseModel):
    success: bool
    backup_codes: Optional[List[str]] = None
    message: str


# ── User ─────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_voice_enrolled: bool
    is_totp_enabled: bool
    created_at: datetime

    class Config:
        orm_mode = True


# ── Audit ────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    id: str
    event_type: str
    ip_address: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        orm_mode = True

class AuditLogListResponse(BaseModel):
    logs: List[AuditLogEntry]
    total: int
