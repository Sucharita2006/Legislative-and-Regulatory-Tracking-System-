"""Semantic scoring via embeddings.

Replaces the topic-keyword scoring in digest_service and live search with
cosine similarity between an embedding of the user's prompt and an embedding
of each bill's text (title + ai_summary + official_summary).

Embedding model: openai/text-embedding-3-small via OpenRouter.
Embeddings are cached in Redis (24-hour TTL) keyed by SHA-256 of the text,
so each unique bill text is only embedded once.
"""

from __future__ import annotations

import hashlib
import logging
import math
from typing import List, Optional

import httpx

from ..config import settings
from ..models import LegislativeDocument
from .cache import get_cache, set_cache

logger = logging.getLogger("aldf.semantic")

EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_CACHE_TTL = 86_400  # 24 hours
CACHE_PREFIX = "aldf:embed:"


def _embed_via_openrouter(text: str) -> Optional[List[float]]:
    """Call OpenRouter embeddings endpoint and return the vector."""
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "AnimalLegislationTracker",
    }
    payload = {"model": EMBEDDING_MODEL, "input": text[:8000]}
    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            return res.json()["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Embedding call failed: {e}")
        return None


def _cache_key(text: str) -> str:
    h = hashlib.sha256(text.strip().encode()).hexdigest()
    return f"{CACHE_PREFIX}{h}"


def get_embedding(text: str) -> Optional[List[float]]:
    """Return embedding for text, using cache when available."""
    if not text or not text.strip():
        return None
    key = _cache_key(text)
    cached = get_cache(key)
    if cached is not None:
        return cached
    vec = _embed_via_openrouter(text)
    if vec is not None:
        set_cache(key, vec, expire=EMBEDDING_CACHE_TTL)
    return vec


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity between two vectors, returns 0.0–1.0."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def bill_text_for_embedding(doc: LegislativeDocument) -> str:
    """Combine the most useful bill fields into a single text for embedding."""
    parts = []
    if doc.title:
        # Repeat title twice — it's the most signal-dense field.
        parts.append(doc.title)
        parts.append(doc.title)
    if doc.policy_area:
        parts.append(f"Policy area: {doc.policy_area}")
    if doc.subjects:
        parts.append("Subjects: " + ", ".join(s.name for s in doc.subjects))
    if doc.ai_summary:
        parts.append(doc.ai_summary[:1500])
    elif doc.official_summary:
        parts.append(doc.official_summary[:1500])
    return " | ".join(parts)


def semantic_score(doc: LegislativeDocument, prompt_embedding: List[float]) -> int:
    """Return a 0-100 semantic relevance score for doc against a prompt embedding.

    All bills — including ALDF priority bills — are scored by cosine similarity
    so results reflect the actual prompt, not a curated list.
    Bills with no embeddable text return 0.
    """
    bill_text = bill_text_for_embedding(doc)
    if not bill_text.strip():
        return 0

    bill_embedding = get_embedding(bill_text)
    if bill_embedding is None:
        # Embedding failed — fall back to existing relevance_score if available
        return doc.relevance_score or 0

    sim = cosine_similarity(prompt_embedding, bill_embedding)
    # Map similarity to 0-100.
    # Scale [0.15, 0.75] → [0, 100].
    low, high = 0.15, 0.75
    clamped = max(0.0, min(1.0, (sim - low) / (high - low)))
    return round(clamped * 100)


def prompt_embedding_for_digest(prompt_text: str) -> Optional[List[float]]:
    """Get (or compute + cache) the embedding for a user's digest prompt."""
    return get_embedding(prompt_text)
