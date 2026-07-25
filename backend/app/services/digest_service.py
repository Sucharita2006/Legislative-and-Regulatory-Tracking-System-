from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Callable, Tuple
import logging
import re
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_

logger = logging.getLogger(__name__)

from ..models import UserProfile, LegislativeDocument, BillAction
from ..config import settings
from .ai_processing import expand_prompt_to_topics, score_against_prompt
from .semantic_scoring import semantic_score, prompt_embedding_for_digest

# Minimum semantic score (0-100) for a bill to appear in a digest. Distinct
# gate from sync.py's AI_THRESHOLD (whether a bill is kept in the DB at all)
# — they happen to share the same value today, but nothing enforces that;
# check both if you're changing either.
DIGEST_SCORE_THRESHOLD = 40


def _time_window(frequency: str) -> Tuple[datetime, datetime, date]:
    """Return (start_time, end_time, start_date) for a digest frequency."""
    end_time = datetime.now()
    if frequency == "daily":
        start_time = end_time - timedelta(hours=settings.DIGEST_WINDOW_DAILY_HOURS)
    else:
        start_time = end_time - timedelta(days=settings.DIGEST_WINDOW_WEEKLY_DAYS)
    return start_time, end_time, start_time.date()


def _query_docs_since(db: Session, since_date: date) -> List[LegislativeDocument]:
    """Bills with recent activity — union of (a) a matching BillAction row in
    the window and (b) last_action_date falling in the window, in case
    BillAction sync lagged behind."""
    return (
        db.query(LegislativeDocument)
        .options(selectinload(LegislativeDocument.subjects))
        .filter(
            or_(
                LegislativeDocument.id.in_(
                    db.query(BillAction.document_id)
                    .filter(BillAction.action_date >= since_date)
                    .distinct()
                ),
                LegislativeDocument.last_action_date >= since_date,
            )
        )
        .all()
    )


def _build_prompt_embeddings(
    matching_prompts: List[Any],
    on_embedding: Optional[Callable[[Any, Any], None]] = None,
) -> Dict[str, Any]:
    """Pre-compute (cached) embeddings for each prompt, enriched with its
    expanded topics/keywords for a better match."""
    prompt_embeddings: Dict[str, Any] = {}
    for prompt in matching_prompts:
        exp = prompt.expanded_topics or {}
        extra_terms = exp.get("keywords", []) + exp.get("topics", [])
        enriched_text = prompt.prompt_text
        if extra_terms:
            enriched_text = prompt.prompt_text + " " + " ".join(extra_terms)
        emb = prompt_embedding_for_digest(enriched_text)
        prompt_embeddings[str(prompt.id)] = emb
        if on_embedding:
            on_embedding(prompt, emb)
    return prompt_embeddings


def _extract_matching_snippet(doc: LegislativeDocument, prompt: Optional[Any]) -> str:
    """Extract a direct quoted sentence snippet from the bill text/summary that best
    matches the target prompt keywords/topics."""
    summary = (doc.ai_summary or "").strip()
    if not summary or summary == "(no AI summary available)":
        return f'"{doc.title.strip()}"' if doc.title else "Legislative update flagged for your watchlist."

    # Handle common abbreviations like U.S. during sentence splitting
    clean_text = re.sub(r'\bU\.S\.', 'U_S_', summary)
    raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', clean_text)
    sentences = [s.replace('U_S_', 'U.S.').strip() for s in raw_sentences if len(s.strip()) > 10]
    if not sentences:
        return f'"{summary}"'

    # Gather target keywords & topics
    exp = (prompt.expanded_topics or {}) if prompt and hasattr(prompt, "expanded_topics") else {}
    keywords = [k.lower() for k in (exp.get("keywords", []) + exp.get("topics", [])) if k]
    if not keywords and prompt and getattr(prompt, "prompt_text", None):
        keywords = [w.lower() for w in prompt.prompt_text.split() if len(w) > 3]

    best_sentence = sentences[0]
    best_score = -1

    for sentence in sentences:
        s_lower = sentence.lower()
        score = sum(1 for kw in keywords if re.search(r'\b' + re.escape(kw) + r'\b', s_lower))
        if score > best_score and score > 0:
            best_score = score
            best_sentence = sentence

    clean_snippet = best_sentence.strip()
    if len(clean_snippet) > 180:
        clean_snippet = clean_snippet[:177].rstrip() + "..."

    return f'"{clean_snippet}"'


def _score_candidate_docs(
    candidate_docs: List[LegislativeDocument],
    matching_prompts: List[Any],
    prompt_embeddings: Dict[str, Any],
    user: UserProfile,
    user_review_bills: set,
    window_start_date: date,
    on_bill_scored: Optional[Callable[[LegislativeDocument, int], None]] = None,
) -> List[Dict[str, Any]]:
    """Score every candidate bill against the user's prompts, keep the ones
    that qualify, and build their digest item dicts."""
    items: List[Dict[str, Any]] = []
    for doc in candidate_docs:
        # Scope filter
        if user.scope == "priority_states" and doc.source == "congress.gov":
            continue

        is_review_bill = doc.source_id in user_review_bills

        # Score against each prompt, keep the best
        best_score = -1
        best_prompt = None
        for prompt in matching_prompts:
            emb = prompt_embeddings.get(str(prompt.id))
            if emb is None:
                # Embedding unavailable — fall back to keyword expansion
                exp = prompt.expanded_topics or {}
                topics = exp.get("topics", [])
                keywords = exp.get("keywords", [])
                score = score_against_prompt(doc, topics, keywords)
            else:
                score = semantic_score(doc, emb)

            if score > best_score:
                best_score = score
                best_prompt = prompt

        if on_bill_scored:
            on_bill_scored(doc, best_score)

        qualifies = best_score >= DIGEST_SCORE_THRESHOLD or is_review_bill
        if not qualifies:
            continue

        if is_review_bill and best_score < DIGEST_SCORE_THRESHOLD:
            best_score = doc.relevance_score or 50
            explanation = "Manually added to your watchlist"
        else:
            explanation = _extract_matching_snippet(doc, best_prompt)

        app_detail_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents/{doc.source_id}"
        external_source_url = doc.source_url or f"https://www.congress.gov/bill/{doc.congress}th-congress/none"

        items.append({
            "document_id": doc.source_id,
            "title": doc.title or "(untitled)",
            "policy_area": doc.policy_area or "Animals",
            "relevance_score": best_score,
            "is_review_bill": is_review_bill,
            "match_reason": {
                "matched_topics": [],
                "matched_keywords": [],
                "explanation": explanation,
            },
            "ai_summary": doc.ai_summary or "(no AI summary available)",
            "app_detail_url": app_detail_url,
            "external_source_url": external_source_url,
            "last_action": {
                "action_date": doc.last_action_date.isoformat() if doc.last_action_date else window_start_date.isoformat(),
                "text": doc.last_action_text or "(no action text available)",
            },
            "matched_prompt_id": str(best_prompt.id) if best_prompt else "watched",
        })
    return items


def _compile_user_digest_items(
    db: Session,
    user: UserProfile,
    matching_prompts: List[Any],
    prompt_embeddings: Dict[str, Any],
    candidate_docs: List[LegislativeDocument],
    start_date: date,
    end_time: datetime,
    on_bill_scored: Optional[Callable[[LegislativeDocument, int], None]] = None,
    on_fallback_docs: Optional[Callable[[int], None]] = None,
) -> Tuple[List[Dict[str, Any]], bool]:
    """Score the primary-window candidates; if nothing qualifies, retry
    against a 30-day activity fallback window. Returns (items, is_fallback_active)."""
    user_review_bills = set(user.review_bills or [])

    items = _score_candidate_docs(
        candidate_docs, matching_prompts, prompt_embeddings, user, user_review_bills,
        window_start_date=start_date, on_bill_scored=on_bill_scored,
    )

    is_fallback_active = False
    if not items:
        fallback_start_date = end_time.date() - timedelta(days=30)
        fallback_docs = _query_docs_since(db, fallback_start_date)
        if fallback_docs:
            if on_fallback_docs:
                on_fallback_docs(len(fallback_docs))
            items = _score_candidate_docs(
                fallback_docs, matching_prompts, prompt_embeddings, user, user_review_bills,
                window_start_date=fallback_start_date, on_bill_scored=on_bill_scored,
            )
            if items:
                is_fallback_active = True

    return items, is_fallback_active


import httpx

def _generate_digest_overall_summary(items: List[Dict[str, Any]]) -> Optional[str]:
    """Generate an overall summary for an email digest using DIGEST_LLM_MODEL (Claude Opus)."""
    if not items or not settings.OPENROUTER_API_KEY:
        return None
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "AnimalLegislationTracker",
    }
    bullets = "\n".join([f"- {i['title']} ({i['policy_area']}): {i['ai_summary']}" for i in items[:10]])
    prompt = (
        "Synthesize a concise 2-3 sentence executive summary for an email legislative briefing "
        f"covering these updates:\n\n{bullets}"
    )
    payload = {
        "model": settings.DIGEST_LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You provide executive summaries of legislative updates. Be concise and factual."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return content.strip() if content else None
    except Exception as e:
        logger.warning("Failed to generate digest overall summary: %s", e)
        return None


def _finalize_digest_payload(
    user: UserProfile,
    frequency: str,
    matching_prompts: List[Any],
    items: List[Dict[str, Any]],
    is_fallback_active: bool,
    start_time: datetime,
    end_time: datetime,
) -> Dict[str, Any]:
    """Sort (review bills first, then by score), cap at DIGEST_MAX_ITEMS,
    group by prompt, and shape the final digest payload."""
    review_items = sorted(
        [i for i in items if i["is_review_bill"]],
        key=lambda x: x["relevance_score"], reverse=True,
    )
    relevance_items = sorted(
        [i for i in items if not i["is_review_bill"]],
        key=lambda x: x["relevance_score"], reverse=True,
    )
    final_items = (review_items + relevance_items)[:settings.DIGEST_MAX_ITEMS]

    prompt_groups_dict = {
        str(p.id): {"prompt_text": p.prompt_text, "items": []}
        for p in matching_prompts
    }
    watched_group: Dict[str, Any] = {"prompt_text": "Tracked Bills", "items": []}

    for item in final_items:
        pid = item.get("matched_prompt_id")
        if pid == "watched":
            watched_group["items"].append(item)
        elif pid and pid in prompt_groups_dict:
            prompt_groups_dict[pid]["items"].append(item)

    prompt_groups = [
        prompt_groups_dict[str(p.id)]
        for p in matching_prompts
        if prompt_groups_dict[str(p.id)]["items"]
    ]
    if watched_group["items"]:
        prompt_groups.append(watched_group)

    overall_summary = _generate_digest_overall_summary(final_items)

    return {
        "recipient": {
            "user_id": str(user.id),
            "email": user.email,
            "frequency": frequency,
            "scope": user.scope,
        },
        "digest_metadata": {
            "generated_at": end_time.isoformat() + "Z",
            "time_window_start": start_time.isoformat() + "Z",
            "time_window_end": end_time.isoformat() + "Z",
            "total_items": len(final_items),
            "max_items_limit": settings.DIGEST_MAX_ITEMS,
        },
        "overall_summary": overall_summary,
        "items": final_items,
        "prompt_groups": prompt_groups,
        "is_fallback_active": is_fallback_active,
    }


def compile_digests(db: Session, frequency: str) -> List[Dict[str, Any]]:
    """Query, score, filter, and compile email digest payloads for all verified users."""

    # 1. Retrieve all verified users with prompts
    users = (
        db.query(UserProfile)
        .filter(UserProfile.is_verified == True)
        .options(selectinload(UserProfile.prompts))
        .all()
    )
    if not users:
        return []

    # 2. Calculate time window
    start_time, end_time, start_date = _time_window(frequency)

    # 3. Candidate bills with recent actions (shared across all users — doesn't depend on user)
    candidate_docs = _query_docs_since(db, start_date)

    payloads = []

    # 4. Per-user scoring
    for user in users:
        matching_prompts = [p for p in user.prompts if p.frequency == frequency]
        if not matching_prompts:
            continue

        prompt_embeddings = _build_prompt_embeddings(matching_prompts)

        logger.debug("%d candidate bills in window", len(candidate_docs))

        items, is_fallback_active = _compile_user_digest_items(
            db, user, matching_prompts, prompt_embeddings, candidate_docs, start_date, end_time,
        )

        if not items:
            continue

        payloads.append(
            _finalize_digest_payload(user, frequency, matching_prompts, items, is_fallback_active, start_time, end_time)
        )

    return payloads


def compile_single_digest(db: Session, email: str, frequency: str = "daily", prompt_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Query, score, filter, and compile email digest payload for a single user by email."""
    # 1. Retrieve the user profile by email
    user = (
        db.query(UserProfile)
        .filter(UserProfile.email == email)
        .options(selectinload(UserProfile.prompts))
        .first()
    )
    if not user:
        return None

    # 2. Calculate time window
    start_time, end_time, start_date = _time_window(frequency)

    # 3. Candidate bills with recent actions
    candidate_docs = _query_docs_since(db, start_date)

    if prompt_id:
        matching_prompts = [p for p in user.prompts if str(p.id) == prompt_id]
    else:
        matching_prompts = [p for p in user.prompts if p.frequency == frequency]
        if not matching_prompts:
            matching_prompts = user.prompts
    if not matching_prompts:
        return None

    prompt_embeddings = _build_prompt_embeddings(matching_prompts)

    items, is_fallback_active = _compile_user_digest_items(
        db, user, matching_prompts, prompt_embeddings, candidate_docs, start_date, end_time,
    )

    return _finalize_digest_payload(user, frequency, matching_prompts, items, is_fallback_active, start_time, end_time)
