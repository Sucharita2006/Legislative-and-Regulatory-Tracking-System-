"""Semantic scoring via embeddings + pgvector ANN search.

Embedding model: openai/text-embedding-3-small via OpenRouter (1536 dims).

Two-level cache:
  1. Redis (24h TTL, keyed by SHA-256 of text) — avoids re-embedding identical text.
  2. DB column (legislative_documents.embedding) — persisted vector used for ANN search.

For live search / Ask-tab queries, vector_search() does a single pgvector
ORDER BY <=> (cosine distance) query instead of loading every bill into Python.
"""

from __future__ import annotations

import hashlib
import logging
import math
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..models import LegislativeDocument
from .cache import get_cache, set_cache

if TYPE_CHECKING:
    pass

logger = logging.getLogger("aldf.semantic")

EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIMS = 1536
EMBEDDING_CACHE_TTL = 86_400  # 24 hours
CACHE_PREFIX = "aldf:embed:"

# Cosine similarity scale: sim in [LOW, HIGH] maps linearly to score [0, 100].
# text-embedding-3-small typically yields 0.2–0.85 for related animal-welfare text.
_SIM_LOW = 0.15
_SIM_HIGH = 0.65


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

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
    """Return embedding for text, using Redis cache when available."""
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


def build_candidate_text(
    title: Optional[str],
    policy_area: Optional[str],
    subject_names: List[str],
    summary: Optional[str],
) -> str:
    """Build the text blob used to embed a bill (stored or not-yet-stored)."""
    parts = []
    if title:
        parts.append(title)
        parts.append(title)  # repeat — highest signal
    if policy_area:
        parts.append(f"Policy area: {policy_area}")
    if subject_names:
        parts.append("Subjects: " + ", ".join(subject_names))
    if summary:
        parts.append(summary[:1500])
    return " | ".join(parts)


def bill_text_for_embedding(doc: LegislativeDocument) -> str:
    """Build the text blob used to embed a bill."""
    subject_names = [s.name for s in doc.subjects] if doc.subjects else []
    summary = doc.ai_summary or doc.official_summary
    return build_candidate_text(doc.title, doc.policy_area, subject_names, summary)


def store_bill_embedding(doc: LegislativeDocument, db: Session) -> bool:
    """Compute and persist the embedding for a bill to the DB column.

    Returns True if newly computed and saved, False if skipped (already set or
    no embeddable text or embedding call failed).
    """
    if doc.embedding is not None:
        return False
    text = bill_text_for_embedding(doc)
    if not text.strip():
        return False
    vec = get_embedding(text)
    if vec is None:
        return False
    doc.embedding = vec
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Score helpers (used by digest_service when iterating a small candidate set)
# ---------------------------------------------------------------------------

def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _sim_to_score(sim: float) -> int:
    clamped = max(0.0, min(1.0, (sim - _SIM_LOW) / (_SIM_HIGH - _SIM_LOW)))
    return round(clamped * 100)


def semantic_score(doc: LegislativeDocument, prompt_embedding: List[float]) -> int:
    """Return 0-100 score for doc against a pre-computed prompt embedding.

    Used by digest_service which already has a small candidate set in memory.
    Prefers the stored DB embedding to avoid re-embedding at query time.
    Falls back to computing+caching the embedding if not stored yet.
    """
    # Prefer the already-stored vector
    if doc.embedding is not None:
        sim = cosine_similarity(prompt_embedding, list(doc.embedding))
        return _sim_to_score(sim)

    bill_text = bill_text_for_embedding(doc)
    if not bill_text.strip():
        return 0

    bill_embedding = get_embedding(bill_text)
    if bill_embedding is None:
        return doc.relevance_score or 0

    sim = cosine_similarity(prompt_embedding, bill_embedding)
    return _sim_to_score(sim)


def prompt_embedding_for_digest(prompt_text: str) -> Optional[List[float]]:
    """Get (or compute + cache) the embedding for a digest prompt."""
    return get_embedding(prompt_text)


# ---------------------------------------------------------------------------
# Semantic pre-filter — used during ingestion (sync.py) to catch animal-related
# bills whose Congress.gov subject/policy-area tags are missing, incomplete, or
# not yet assigned. This is a loose recall net, not a precision filter: the
# downstream AI relevance score (ai_processing.py, threshold 40) remains the
# real gate. False positives here just cost one extra AI call; false negatives
# mean a real animal bill is lost, so the threshold is deliberately low.
# ---------------------------------------------------------------------------

ANCHOR_PHRASES: List[str] = [
    "Animal welfare and protection of animals from cruelty and abuse",
    "Regulation of animal testing and the use of animals in scientific research",
    "Welfare and treatment of farmed animals, livestock, and factory farming practices",
    "Protection of wildlife, endangered species, and habitat conservation",
    "Regulation of pets, companion animals, and service animals",
    "Wildlife trafficking, animal smuggling, and crimes against animals",
    "Animal shelters, rescue operations, and humane treatment standards",
    "Veterinary medicine, animal health, and infectious or parasitic animal diseases",
    "Aquaculture, seafood, meat, and food supply safety and labeling standards",
    "Hunting, fishing, and wildlife management regulations",
    "Conservation of marine, coastal, and freshwater ecosystems, fisheries, and habitats",
    "Protection of birds, fish, insects, mammals, and reptiles and their natural habitats",
    "Zoos, aquariums, circuses, and the treatment of captive or exhibited animals",
    "Animal fighting, dogfighting, cockfighting, and horse soring or racing welfare",
    "Humane slaughter methods and standards for livestock processing",
    "Funding, appropriations, and enforcement programs for animal welfare agencies",
]

# Looser than the Ask-tab scale (_SIM_LOW/_SIM_HIGH) because this screens thin
# ingestion-time text (title + tags + maybe a summary), not a deliberately
# worded user search prompt.
_PREFILTER_SIM_LOW = 0.12
_PREFILTER_SIM_HIGH = 0.50

# 0-100 scale, deliberately low — see module docstring above. Raised from 15 to 20
# after expanding ANCHOR_PHRASES from 7 to 16: taking the max similarity over more
# anchors mechanically raises typical scores (more chances to land near one), so
# the threshold was nudged up to keep selectivity roughly in line with before.
PREFILTER_THRESHOLD = 20

_anchor_embeddings_cache: Optional[List[List[float]]] = None


def _get_anchor_embeddings() -> List[List[float]]:
    """Lazily embed and cache the anchor phrases for the lifetime of the process."""
    global _anchor_embeddings_cache
    if _anchor_embeddings_cache is None:
        embeddings = []
        for phrase in ANCHOR_PHRASES:
            vec = get_embedding(phrase)
            if vec is not None:
                embeddings.append(vec)
        _anchor_embeddings_cache = embeddings
    return _anchor_embeddings_cache


def semantic_prefilter(text: str) -> Dict[str, Any]:
    """Score candidate bill text against the animal-welfare anchor set.

    Returns {"score": 0-100 int, "embedding": vector or None}. Score is 0 if
    the text is empty or embedding fails — callers should fall back to the
    curated subject/policy-area match in that case rather than discarding.
    """
    if not text.strip():
        return {"score": 0, "embedding": None}

    vec = get_embedding(text)
    if vec is None:
        return {"score": 0, "embedding": None}

    anchors = _get_anchor_embeddings()
    if not anchors:
        return {"score": 0, "embedding": vec}

    best_sim = max(cosine_similarity(vec, anchor) for anchor in anchors)
    clamped = max(0.0, min(1.0, (best_sim - _PREFILTER_SIM_LOW) / (_PREFILTER_SIM_HIGH - _PREFILTER_SIM_LOW)))
    score = round(clamped * 100)
    return {"score": score, "embedding": vec}


# ---------------------------------------------------------------------------
# pgvector ANN search — the primary search path for live/Ask queries
# ---------------------------------------------------------------------------

def vector_search(
    prompt: str,
    db: Session,
    limit: int = 20,
    min_score: int = 10,
) -> List[Dict[str, Any]]:
    """Search bills by semantic similarity to prompt using pgvector ANN.

    Returns a list of dicts with keys:
        doc         – LegislativeDocument ORM object
        prompt_score – 0-100 integer score

    Bills without a stored embedding are excluded (they will be picked up
    on next backfill run). Falls back to [] on any error so callers can
    gracefully degrade to keyword search.
    """
    prompt_emb = get_embedding(prompt)
    if prompt_emb is None:
        logger.warning("vector_search: could not embed prompt, returning empty.")
        return []

    try:
        from pgvector.sqlalchemy import Vector
        from sqlalchemy import func as sqlfunc
        from sqlalchemy.orm import selectinload

        # pgvector cosine distance operator: <=>
        # ORDER BY distance ASC → most similar first.
        distance_expr = LegislativeDocument.embedding.op("<=>")(prompt_emb)

        rows = (
            db.query(LegislativeDocument, distance_expr.label("distance"))
            .options(selectinload(LegislativeDocument.subjects))
            .filter(LegislativeDocument.embedding.isnot(None))
            .order_by(distance_expr.asc())
            .limit(limit * 3)  # over-fetch so we can filter by min_score
            .all()
        )

        results = []
        for doc, distance in rows:
            sim = 1.0 - float(distance)  # cosine distance → similarity
            score = _sim_to_score(sim)
            if score < min_score:
                continue
            results.append({"doc": doc, "prompt_score": score})
            if len(results) >= limit:
                break

        return results

    except Exception as e:
        logger.warning(f"vector_search failed: {e}")
        return []
