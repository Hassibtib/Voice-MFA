# Voice MFA System

**Secure Multi-Factor Authentication Using Voice Biometrics**

A Multi-Factor Authentication (MFA) system that combines password authentication, voice biometrics, and optional Time-Based One-Time Password (TOTP) verification. Built as a project at the National Higher School of Artificial Intelligence (ENSIA).

## Overview

Traditional password-only authentication is vulnerable to phishing, leaks, brute-force attacks, and password reuse. This project strengthens login security by combining three authentication factors:

- **Something you know** — password
- **Something you are** — voice biometrics
- **Something you have** — TOTP authenticator app

The project includes two implementations:
- A local **Python prototype**
- A full-stack web application using **FastAPI** and **React**

## Features

- 🔐 Password authentication with **bcrypt** hashing
- 🎙️ Voice biometric enrollment and verification using **Resemblyzer** speaker embeddings
- 📊 Speaker verification via **cosine similarity** comparison
- 🔑 **JWT**-based session management (pre-auth and full-session tokens)
- 📱 **TOTP** (Time-Based One-Time Password) authenticator support
- 🗣️ Randomized challenge phrases to reduce replay attacks
- 🛡️ Redis-based challenge expiration
- 📝 Audit logging (login attempts, enrollment, verification, lockouts)
- 🚫 Account lockout protection

## Tech Stack

**Frontend**
- React + Vite
- Browser-based audio recording
- User dashboard & MFA verification pages

**Backend**
- FastAPI (REST API)
- SQLAlchemy ORM
- JWT authentication
- Resemblyzer for voice embeddings

**Database**
- PostgreSQL / SQLite
- Stores user accounts, voice embeddings, and audit logs

**Other**
- Redis (challenge storage)
- Docker

## How It Works

### Enrollment
1. User records several voice samples
2. Audio is converted into NumPy arrays
3. Resemblyzer extracts 256-dimensional voice embeddings
4. Embeddings are stored in the database

### Authentication Flow
1. User enters username and password
2. Backend validates credentials and issues a pre-auth token
3. User records a voice sample in response to a challenge phrase
4. Backend extracts a new embedding and compares it via cosine similarity
5. Optional TOTP verification
6. Backend issues a full-session token

## Database Schema

| Table | Description |
|---|---|
| **Users** | Username, email, password hash, TOTP status, voice enrollment status |
| **Voice Profiles** | Serialized voice embeddings |
| **Audit Logs** | Login attempts, voice verification, enrollment, lockout events |

## Security Analysis

**Strengths**
- Multi-factor authentication
- Voice embeddings for biometric verification
- bcrypt password hashing
- Redis challenge expiration
- Audit logging and account lockout protection

**Known Limitations**
- No anti-spoofing detection
- No deepfake detection
- No spoken phrase verification in the web version

## Future Improvements

- Anti-spoofing systems
- Deepfake detection
- HTTPS deployment
- Rate limiting
- Improved session management

## Team

Developed by:
- Tibbeche Abed ElHassib Ammar
- Ouaret Wail
- Abdennour Khaled
- Benyoub Khalil

**Supervisor:** Pr. Lounis Karim
**Academic Year:** 2025–2026

## References

- [Resemblyzer Documentation](https://github.com/resemble-ai/Resemblyzer)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://www.sqlalchemy.org/)
- JWT RFC 7519
- TOTP RFC 6238
- [Redis Documentation](https://redis.io/documentation)
- [bcrypt Documentation](https://pypi.org/project/bcrypt/)
- [Docker Documentation](https://docs.docker.com/)
