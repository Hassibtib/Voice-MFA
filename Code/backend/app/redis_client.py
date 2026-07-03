# ============================================================
#  redis_client.py — Redis or in-memory fallback
# ============================================================
#
#  Uses real Redis when REDIS_URL is set to a redis:// URL.
#  Falls back to an in-memory dict when Redis is unavailable
#  (for local development without Docker).
# ============================================================

import time
import threading
from .config import settings


# ── In-memory fallback (no Redis required) ───────────────────

class InMemoryRedis:
    """Thread-safe in-memory key-value store mimicking a Redis subset."""

    def __init__(self):
        self._store = {}
        self._ttl = {}
        self._lock = threading.Lock()

    def setex(self, key, ttl, value):
        with self._lock:
            self._store[key] = value
            self._ttl[key] = time.time() + ttl

    def get(self, key):
        with self._lock:
            if key in self._store:
                if key in self._ttl and time.time() > self._ttl[key]:
                    del self._store[key]
                    del self._ttl[key]
                    return None
                return self._store[key]
            return None

    def delete(self, key):
        with self._lock:
            self._store.pop(key, None)
            self._ttl.pop(key, None)
            return 1

    def pipeline(self):
        return _InMemoryPipeline(self)


class _InMemoryPipeline:
    def __init__(self, store):
        self._store = store
        self._cmds = []

    def get(self, key):
        self._cmds.append(("get", key))
        return self

    def delete(self, key):
        self._cmds.append(("delete", key))
        return self

    def execute(self):
        results = []
        for cmd, key in self._cmds:
            if cmd == "get":
                results.append(self._store.get(key))
            elif cmd == "delete":
                results.append(self._store.delete(key))
        return results


# ── Factory ──────────────────────────────────────────────────

_client = None


def get_redis():
    """Return a Redis client (real or in-memory fallback)."""
    global _client
    if _client is not None:
        return _client

    if settings.REDIS_URL and settings.REDIS_URL.startswith("redis://"):
        try:
            import redis
            pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL, decode_responses=True
            )
            _client = redis.Redis(connection_pool=pool)
            _client.ping()  # verify connection
            print("  ✓ Connected to Redis")
            return _client
        except Exception:
            print("  ⚠ Redis unavailable, using in-memory fallback")

    _client = InMemoryRedis()
    print("  ✓ Using in-memory challenge store (no Redis)")
    return _client
