# 🎙 Voice MFA System — Web Application

A **Multi-Factor Authentication** platform combining **voice biometrics**, **TOTP (Time-based One-Time Passwords)**, and **backup codes** — built with FastAPI, React, PostgreSQL, and Redis.

---

## 📁 Project Structure

```
voice_mfa/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI application entry point
│   │   ├── config.py            ← Pydantic settings (env vars)
│   │   ├── database.py          ← SQLAlchemy engine + session
│   │   ├── redis_client.py      ← Redis connection pool
│   │   ├── models.py            ← User, VoiceProfile, BackupCode, AuditLog
│   │   ├── schemas.py           ← Pydantic request/response models
│   │   ├── dependencies.py      ← JWT auth guards
│   │   ├── services/
│   │   │   ├── auth_service.py       ← Password hashing, JWT tokens
│   │   │   ├── voice_service.py      ← Resemblyzer embeddings + cosine similarity
│   │   │   ├── challenge_service.py  ← Challenge phrase anti-replay (Redis)
│   │   │   ├── totp_service.py       ← TOTP secret/code management
│   │   │   └── audit_service.py      ← Structured audit logging
│   │   └── routes/
│   │       ├── auth.py          ← Register, login, voice/TOTP/backup verify
│   │       ├── enrollment.py    ← Voice sample upload + enrollment
│   │       ├── challenge.py     ← Challenge phrase endpoint
│   │       ├── totp.py          ← TOTP setup/verify/disable
│   │       └── audit.py         ← Audit log viewer
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx             ← React entry point
│   │   ├── App.jsx              ← Router + page layout
│   │   ├── index.css            ← Design system (dark glassmorphism)
│   │   ├── api/client.js        ← HTTP client for all endpoints
│   │   ├── context/AuthContext.jsx  ← Global auth state
│   │   ├── hooks/useAudioRecorder.js ← WAV capture at 16kHz mono
│   │   ├── components/          ← Navbar, AudioVisualizer, ProtectedRoute
│   │   └── pages/               ← Login, Register, Dashboard, Enroll, Verify, TOTP
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml           ← One-command deployment
├── .env.example                 ← Environment variable template
└── README.md                    ← You are here
```

---

## 🚀 Quick Start (Docker)

### 1. Clone and configure

```bash
cd voice_mfa
cp .env.example .env
# Edit .env if needed (the defaults work for development)
```

### 2. Start everything

```bash
docker-compose up --build
```

This starts:
| Service    | Port  | Description                  |
|------------|-------|------------------------------|
| PostgreSQL | 5432  | User data, voice profiles    |
| Redis      | 6379  | Challenge anti-replay cache  |
| Backend    | 8000  | FastAPI + voice ML engine    |
| Frontend   | 3000  | React (Vite dev server)      |

### 3. Open the app

Go to **http://localhost:3000** in your browser.

> ⚠️ The first startup takes a few minutes because the backend downloads the Resemblyzer voice model (~50 MB) and PyTorch CPU (~200 MB).

---

## 👤 How to Register and Enroll

### Step 1 — Register
1. Go to http://localhost:3000/register
2. Create an account (username, email, password)

### Step 2 — Log in
1. Go to http://localhost:3000/login
2. Enter your credentials
3. Since no MFA is configured yet, you'll go straight to the dashboard

### Step 3 — Enroll your voice
1. Click **"Voice Enroll"** in the nav bar (or the dashboard card)
2. Allow microphone access when prompted
3. Record **at least 3 voice samples** (5 seconds each)
   - Speak naturally — say different sentences each time
4. Click **"Complete Enrollment"**
5. Future logins will require voice verification

### Step 4 — Set up TOTP (optional)
1. Click **"TOTP"** in the nav bar
2. Click **"Begin Setup"**
3. Scan the QR code with Google Authenticator / Authy / etc.
4. Enter the 6-digit code to verify
5. **Save your backup codes!** They won't be shown again

---

## 🔐 Authentication Flow

```
Password Login
     ↓
[pre-auth JWT issued]
     ↓
Voice Verification ←── Challenge phrase (anti-replay)
  • User reads random phrase aloud
  • Audio uploaded as 16kHz WAV
  • Resemblyzer extracts 256-d embedding
  • Cosine similarity vs enrolled profile
  • Score >= 0.80 -> PASS
     ↓
TOTP Verification (if enabled)
  • 6-digit code from authenticator app
  • pyotp validates with ±1 window
     ↓
[full session JWT issued]
     ↓
Dashboard Access ✅
```

---

## 🧪 Testing with curl

### Register
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@test.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

### Get challenge phrase (requires pre-auth token)
```bash
curl http://localhost:8000/api/challenge \
  -H "Authorization: Bearer <PRE_AUTH_TOKEN>"
```

### Upload voice sample for enrollment (requires full session token)
```bash
curl -X POST http://localhost:8000/api/enrollment/voice/sample \
  -H "Authorization: Bearer <TOKEN>" \
  -F "audio=@sample.wav"
```

### Complete enrollment
```bash
curl -X POST http://localhost:8000/api/enrollment/voice/complete \
  -H "Authorization: Bearer <TOKEN>"
```

### Voice verification
```bash
curl -X POST http://localhost:8000/api/auth/verify-voice \
  -H "Authorization: Bearer <PRE_AUTH_TOKEN>" \
  -F "challenge_id=<CHALLENGE_ID>" \
  -F "audio=@recording.wav"
```

### Health check
```bash
curl http://localhost:8000/api/health
```

---

## 🛠 Running Without Docker (Manual)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install PyTorch CPU
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install deps
pip install -r requirements.txt

# Set environment variables
set DATABASE_URL=postgresql://user:pass@localhost:5432/voicemfa
set REDIS_URL=redis://localhost:6379/0
set JWT_SECRET_KEY=dev-secret

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> You'll need PostgreSQL and Redis running locally.

---

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Browser   │────→│   Vite Dev   │────→│  FastAPI    │
│   (React)   │     │  Server:3000 │     │  API:8000   │
│             │     │  (proxy /api)│     │             │
│  WAV 16kHz  │     └──────────────┘     │  Services:  │
│  capture    │                          │  • voice    │
│  via Web    │                          │  • auth     │
│  Audio API  │                          │  • totp     │
└─────────────┘                          │  • challenge│
                                         └──────┬──────┘
                                                │
                              ┌─────────────────┼───────────────┐
                              │                 │               │
                        ┌─────┴──────┐   ┌──────┴────┐   ┌─────┴─────┐
                        │ PostgreSQL │   │   Redis   │   │Resemblyzer│
                        │   :5432    │   │   :6379   │   │  (torch)  │
                        │            │   │           │   │           │
                        │ • users    │   │ • challenge│  │ • 256-d   │
                        │ • profiles │   │   anti-   │   │  voice    │
                        │ • backups  │   │   replay  │   │  embed-   │
                        │ • audit    │   │   cache   │   │  dings    │
                        └────────────┘   └───────────┘   └───────────┘
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| **Voice biometrics** | Resemblyzer neural net → 256-d embeddings + cosine similarity |
| **Challenge anti-replay** | Unique phrase per attempt, stored in Redis with TTL, consumed on use |
| **Account lockout** | 5 failed attempts → 15-minute lock (configurable) |
| **TOTP** | RFC 6238 compliant via pyotp, ±1 time-window tolerance |
| **Backup codes** | 10 single-use hex codes, bcrypt-hashed in DB |
| **JWT two-stage** | Pre-auth token (short-lived) → full session after MFA |
| **Audit logging** | Every auth event logged to PostgreSQL with IP, user-agent, details |
| **Password hashing** | bcrypt with auto-generated salt |

---

## ⚠️ Known Limitations & Future Improvements

### Limitations
- **No speech-to-text verification** — the challenge phrase is displayed for liveness but spoken content is not verified server-side (would require Vosk/Whisper)
- **Voice model is CPU-based** — first request after startup is slow while the model loads
- **No HTTPS in dev** — microphone access requires HTTPS in production (works on localhost)
- **No rate limiting** — should add Redis-based rate limiting for production
- **No email verification** — registration doesn't verify email addresses

### Future Improvements
- Add Vosk/Whisper for speech-to-text content verification
- GPU acceleration for voice encoder
- WebSocket-based real-time audio streaming
- Admin panel for user management
- Email-based account recovery
- Session management (list active sessions, revoke)
- FIDO2/WebAuthn as an additional factor
- Liveness detection (anti-spoofing)

---

## 📝 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Password login → pre-auth token |
| POST | `/api/auth/verify-voice` | Pre-auth | Voice verification + challenge |
| POST | `/api/auth/verify-totp` | Pre-auth | TOTP code verification |
| POST | `/api/auth/verify-backup-code` | Pre-auth | Backup code verification |
| GET | `/api/auth/me` | Full | Get current user info |
| GET | `/api/challenge` | Pre-auth | Get fresh challenge phrase |
| GET | `/api/enrollment/voice/status` | Pre-auth | Enrollment progress |
| POST | `/api/enrollment/voice/sample` | Full | Upload voice sample |
| POST | `/api/enrollment/voice/complete` | Full | Finalize enrollment |
| DELETE | `/api/enrollment/voice` | Full | Delete enrollment |
| POST | `/api/totp/setup` | Full | Start TOTP setup |
| POST | `/api/totp/verify-setup` | Full | Verify & enable TOTP |
| POST | `/api/totp/disable` | Full | Disable TOTP |
| GET | `/api/audit/logs` | Full | Get audit log entries |
| GET | `/api/health` | — | Health check |
