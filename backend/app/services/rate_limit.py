"""Lightweight rate limiting for cost-incurring endpoints (AI-driven search).

Fixed-window counter, keyed by user email when known — falling back to
client IP for anonymous/direct callers. Email-first matters because
/search/live is also reached via frontend3's server-side proxy, where every
request looks like it comes from the same IP (the Next.js server) regardless
of which real user triggered it; keying on the email the frontend already
passes gives real per-user protection in that case.

Reuses the same Redis client (with in-memory fallback) as services.cache —
no new infra dependency. Fails open: if the limiter itself errors, the
request is allowed rather than blocking real traffic on an internal fault.
"""
import json
import logging
import time
from typing import Optional

from fastapi import HTTPException, Request

from .cache import get_redis_client, in_memory_cache

logger = logging.getLogger("aldf.ratelimit")

_KEY_PREFIX = "aldf:ratelimit:"


def _identity(request: Optional[Request], user_email: Optional[str]) -> str:
    if user_email and user_email.strip():
        return f"email:{user_email.strip().lower()}"
    if request is not None and request.client:
        return f"ip:{request.client.host}"
    return "ip:unknown"


def _increment(key: str, window_seconds: int) -> int:
    client = get_redis_client()
    if client is in_memory_cache:
        # Single-process, best-effort fallback for when Redis is unavailable.
        # Tracks its own window_start rather than just refreshing the cache
        # entry's TTL on every call — naively calling set(..., ex=window_seconds)
        # on every hit (including rejected ones) would keep extending the
        # window forever under sustained traffic, so a client that keeps
        # getting rate-limited and keeps retrying would never see it reset.
        now = time.time()
        raw = client.get(key)
        count, window_start = 0, now
        if raw:
            try:
                data = json.loads(raw)
                count, window_start = data["count"], data["window_start"]
            except (ValueError, KeyError, TypeError):
                count, window_start = 0, now
        if now - window_start >= window_seconds:
            count, window_start = 0, now
        count += 1
        client.set(key, json.dumps({"count": count, "window_start": window_start}), ex=window_seconds)
        return count
    count = client.incr(key)
    if count == 1:
        client.expire(key, window_seconds)
    return count


def enforce_rate_limit(
    request: Optional[Request],
    scope: str,
    limit: int,
    window_seconds: int = 60,
    user_email: Optional[str] = None,
) -> None:
    """Raise HTTPException(429) if this identity has exceeded `limit`
    requests per `window_seconds` for `scope`. Fails open on internal error."""
    identity = _identity(request, user_email)
    key = f"{_KEY_PREFIX}{scope}:{identity}"
    try:
        count = _increment(key, window_seconds)
    except Exception as e:
        logger.warning(f"Rate limit check failed for {key}: {e}. Allowing request.")
        return
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limit} requests per {window_seconds}s). Please slow down and try again shortly.",
        )
