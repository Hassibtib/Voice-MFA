# ============================================================
#  models.py — SQLAlchemy ORM models
# ============================================================
#
#  Uses portable column types that work on both PostgreSQL
#  and SQLite (for local development without Docker).
# ============================================================

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, Float,
    DateTime, ForeignKey, LargeBinary, Text, JSON,
    TypeDecorator,
)
from sqlalchemy.orm import relationship

from .database import Base


# ── Portable UUID type (PostgreSQL UUID or SQLite String) ────

class GUID(TypeDecorator):
    """Platform-independent GUID type."""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=False))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return str(value)
        return value


def _new_id():
    return str(uuid.uuid4())


# ── User ─────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(GUID(), primary_key=True, default=_new_id)
    username        = Column(String(50), unique=True, nullable=False, index=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    password_hash   = Column(String(255), nullable=False)

    is_active           = Column(Boolean, default=True)
    is_voice_enrolled   = Column(Boolean, default=False)
    is_totp_enabled     = Column(Boolean, default=False)
    totp_secret         = Column(String(255), nullable=True)

    failed_attempts = Column(Integer, default=0)
    locked_until    = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    voice_profiles = relationship("VoiceProfile", back_populates="user", cascade="all, delete-orphan")
    backup_codes   = relationship("BackupCode",   back_populates="user", cascade="all, delete-orphan")
    audit_logs     = relationship("AuditLog",     back_populates="user")

    def __repr__(self):
        return f"<User {self.username}>"


# ── Voice Profile ────────────────────────────────────────────

class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id            = Column(GUID(), primary_key=True, default=_new_id)
    user_id       = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    embedding     = Column(LargeBinary, nullable=False)   # numpy array serialised to bytes
    sample_number = Column(Integer, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="voice_profiles")


# ── Backup Code ──────────────────────────────────────────────

class BackupCode(Base):
    __tablename__ = "backup_codes"

    id         = Column(GUID(), primary_key=True, default=_new_id)
    user_id    = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code_hash  = Column(String(255), nullable=False)
    is_used    = Column(Boolean, default=False)
    used_at    = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="backup_codes")


# ── Audit Log ────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(GUID(), primary_key=True, default=_new_id)
    user_id     = Column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type  = Column(String(50), nullable=False, index=True)
    ip_address  = Column(String(50),  nullable=True)
    user_agent  = Column(String(500), nullable=True)
    details     = Column(JSON, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
