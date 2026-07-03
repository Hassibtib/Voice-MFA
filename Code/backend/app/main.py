import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base

logger = logging.getLogger("voicemfa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    logger.info("Creating database tables …")
    Base.metadata.create_all(bind=engine)

    logger.info("Pre-loading voice encoder model …")
    from .services.voice_service import preload_encoder
    preload_encoder()

    logger.info("Voice MFA backend ready.")
    yield
    logger.info("Shutting down …")


app = FastAPI(
    title="Voice MFA API",
    description="Multi-Factor Authentication with Voice Biometrics, TOTP, and Backup Codes",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routes.auth       import router as auth_router
from .routes.enrollment import router as enrollment_router
from .routes.challenge  import router as challenge_router
from .routes.totp       import router as totp_router
from .routes.audit      import router as audit_router

app.include_router(auth_router)
app.include_router(enrollment_router)
app.include_router(challenge_router)
app.include_router(totp_router)
app.include_router(audit_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "voice-mfa-backend"}
