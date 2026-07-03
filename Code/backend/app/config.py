from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./voicemfa.db"

    REDIS_URL: str = "memory"

    JWT_SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_PRE_AUTH_EXPIRE_MINUTES: int = 10
    JWT_FULL_SESSION_EXPIRE_MINUTES: int = 60

    SIMILARITY_THRESHOLD: float = 0.80
    MIN_ENROLLMENT_SAMPLES: int = 3
    MAX_ENROLLMENT_SAMPLES: int = 10

    MAX_FAILED_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15
    CHALLENGE_EXPIRE_SECONDS: int = 120

    TOTP_ISSUER: str = "VoiceMFA"
    NUM_BACKUP_CODES: int = 10

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
