"""Concurrency locks for expensive, long-running background jobs (historical
backfill, action backfill, daily sync, AI reprocessing, digest sends).

These endpoints are already gated by require_internal_key, but that only
proves the caller is trusted — it does nothing to stop the *same* trusted
caller (or a leaked key) from triggering two overlapping runs of the same
job. Two concurrent /sync/backfill/119 runs would race against the same
Congress, double API/AI cost and risking DB races; two concurrent
/digest/send/daily runs would double-email every user. A lock, not a rate
limit, is the right tool for that: the risk is duplication, not frequency.

Reuses the same Redis client (with in-memory fallback) as services.cache.
Uses SET NX (atomic set-if-absent) so acquisition is race-free under real
concurrency; the in-memory fallback approximates this for local/single-process
use when Redis is unavailable. Fails open on any internal error — a broken
lock backend must not permanently block a legitimate job trigger.
"""
import logging

from .cache import get_redis_client, in_memory_cache

logger = logging.getLogger("aldf.joblock")

_KEY_PREFIX = "aldf:joblock:"

# Safety-net TTL: if a worker crashes without releasing its lock, it expires
# on its own instead of blocking that job type forever. Long enough to cover
# a full historical backfill.
DEFAULT_LOCK_TTL_SECONDS = 6 * 60 * 60  # 6 hours


def try_acquire_lock(scope: str, ttl_seconds: int = DEFAULT_LOCK_TTL_SECONDS) -> bool:
    """Attempt to acquire the lock for `scope`. Returns True if acquired —
    the caller now owns it and must call release_lock(scope) when the job
    finishes (success, failure, or exception). Returns False if another job
    of this type is already running.
    """
    key = f"{_KEY_PREFIX}{scope}"
    try:
        client = get_redis_client()
        if client is in_memory_cache:
            if client.get(key) is not None:
                return False
            client.set(key, "1", ex=ttl_seconds)
            return True
        acquired = client.set(key, "1", nx=True, ex=ttl_seconds)
        return bool(acquired)
    except Exception as e:
        logger.warning(f"Lock acquire failed for scope '{scope}': {e}. Allowing job to proceed.")
        return True


def release_lock(scope: str) -> None:
    key = f"{_KEY_PREFIX}{scope}"
    try:
        client = get_redis_client()
        client.delete(key)
    except Exception as e:
        logger.warning(f"Lock release failed for scope '{scope}': {e} (will expire via TTL).")
