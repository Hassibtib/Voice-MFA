# ============================================================
#  voice_service.py — Speaker verification via Resemblyzer
# ============================================================
#
#  Uses a pretrained deep neural network (Resemblyzer) to extract
#  256-dimensional voice embeddings and compare them via cosine
#  similarity for speaker verification.
# ============================================================

import io
from typing import List, Optional, Tuple

import numpy as np
import soundfile as sf
from resemblyzer import VoiceEncoder, preprocess_wav

# ── Singleton encoder (loaded once) ──────────────────────────

_encoder: Optional[VoiceEncoder] = None


def get_encoder() -> VoiceEncoder:
    global _encoder
    if _encoder is None:
        _encoder = VoiceEncoder()
    return _encoder


def preload_encoder():
    """Call at startup to download/load the model eagerly."""
    get_encoder()


# ── Audio helpers ────────────────────────────────────────────

def audio_bytes_to_numpy(audio_bytes: bytes) -> Tuple[np.ndarray, int]:
    """
    Convert uploaded WAV bytes → (float32 mono numpy array, sample_rate).
    """
    buf = io.BytesIO(audio_bytes)
    audio, sr = sf.read(buf, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)          # stereo → mono
    audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)
    audio = np.clip(audio, -1.0, 1.0).astype(np.float32)
    return audio, sr


def is_audio_valid(audio: np.ndarray, min_level: float = 0.005) -> bool:
    """Return False if audio is near-silent."""
    return float(np.max(np.abs(audio))) >= min_level


# ── Embedding ────────────────────────────────────────────────

def embed_audio(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """Extract a 256-d voice embedding from raw audio."""
    encoder = get_encoder()
    wav = preprocess_wav(audio, source_sr=sample_rate)
    return encoder.embed_utterance(wav)


def embedding_to_bytes(emb: np.ndarray) -> bytes:
    """Serialise a numpy embedding for database storage."""
    buf = io.BytesIO()
    np.save(buf, emb)
    return buf.getvalue()


def bytes_to_embedding(data: bytes) -> np.ndarray:
    """Deserialise bytes back to a numpy embedding."""
    buf = io.BytesIO(data)
    return np.load(buf, allow_pickle=False)


# ── Cosine similarity ───────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors (range 0–1 for embeddings)."""
    a_n = a / (np.linalg.norm(a) + 1e-9)
    b_n = b / (np.linalg.norm(b) + 1e-9)
    return float(np.dot(a_n, b_n))


# ── Verification ─────────────────────────────────────────────

def verify_voice(
    audio: np.ndarray,
    sample_rate: int,
    stored_embeddings_bytes: List[bytes],
    threshold: float = 0.80,
) -> Tuple[bool, float]:
    """
    Compare a test audio against all stored enrollment embeddings.

    Returns (is_match, similarity_score).
    """
    test_emb = embed_audio(audio, sample_rate)
    stored = [bytes_to_embedding(b) for b in stored_embeddings_bytes]
    mean_emb = np.mean(stored, axis=0)
    score = cosine_similarity(test_emb, mean_emb)
    return score >= threshold, round(score, 4)
