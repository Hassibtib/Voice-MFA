import json
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from ..config import settings
from ..redis_client import get_redis

WORD_BANK = [
    "apple", "bridge", "canyon", "delta", "eagle",
    "falcon", "glacier", "harbor", "island", "jungle",
    "kestrel", "lantern", "marble", "nebula", "ocean",
    "pillar", "quartz", "raven", "silver", "thunder",
    "ultra", "valley", "winter", "xenon", "yellow", "zephyr",
    "amber", "bronze", "copper", "dagger", "ember",
    "forest", "gravel", "hollow", "iron", "jasper",
]

CHALLENGE_WORD_COUNT = 4


def generate_challenge() -> tuple[str, str, int]:
    """
    Create a fresh challenge phrase.

    Returns (challenge_id, phrase, expires_in_seconds).
    """
    words = random.sample(WORD_BANK, CHALLENGE_WORD_COUNT)
    number = random.randint(100, 999)
    phrase = " ".join(words) + f" {number}"
    challenge_id = str(uuid.uuid4())

    r = get_redis()
    r.setex(
        f"challenge:{challenge_id}",
        settings.CHALLENGE_EXPIRE_SECONDS,
        json.dumps({
            "phrase": phrase,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }),
    )

    return challenge_id, phrase, settings.CHALLENGE_EXPIRE_SECONDS


def validate_and_consume(challenge_id: str) -> Optional[str]:
    """
    Validate a challenge ID and consume it (one-time use).

    Returns the phrase if valid, None if expired/already used.
    """
    r = get_redis()
    key = f"challenge:{challenge_id}"

    # Atomically get-and-delete
    pipe = r.pipeline()
    pipe.get(key)
    pipe.delete(key)
    results = pipe.execute()

    data = results[0]
    if data is None:
        return None

    parsed = json.loads(data)
    return parsed["phrase"]
