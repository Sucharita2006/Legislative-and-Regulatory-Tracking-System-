from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_

from ..models import UserProfile, LegislativeDocument, BillAction
from ..config import settings
from .ai_processing import expand_prompt_to_topics, score_against_prompt
from .semantic_scoring import semantic_score, prompt_embedding_for_digest

# Minimum semantic score (0-100) for a bill to appear in a digest.
DIGEST_SCORE_THRESHOLD = 40


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
    end_time = datetime.now()
    if frequency == "daily":
        start_time = end_time - timedelta(hours=settings.DIGEST_WINDOW_DAILY_HOURS)
    else:
        start_time = end_time - timedelta(days=settings.DIGEST_WINDOW_WEEKLY_DAYS)

    start_date = start_time.date()

    # 3. Candidate bills with recent actions — union of two sources:
    #    (a) bills with a matching BillAction row in the window
    #    (b) bills whose last_action_date falls in the window but BillAction sync may have failed
    candidate_docs = (
        db.query(LegislativeDocument)
        .options(selectinload(LegislativeDocument.subjects))
        .filter(
            or_(
                LegislativeDocument.id.in_(
                    db.query(BillAction.document_id)
                    .filter(BillAction.action_date >= start_date)
                    .distinct()
                ),
                LegislativeDocument.last_action_date >= start_date,
            )
        )
        .all()
    )

    payloads = []

    # 4. Per-user scoring
    for user in users:
        matching_prompts = [p for p in user.prompts if p.frequency == frequency]
        if not matching_prompts:
            continue

        user_review_bills = set(user.review_bills or [])

        # Pre-compute prompt embeddings (cached)
        prompt_embeddings: Dict[str, Any] = {}
        for prompt in matching_prompts:
            # Enrich the prompt text with expanded topics/keywords for a better embedding
            exp = prompt.expanded_topics or {}
            extra_terms = exp.get("keywords", []) + exp.get("topics", [])
            enriched_text = prompt.prompt_text
            if extra_terms:
                enriched_text = prompt.prompt_text + " " + " ".join(extra_terms)
            emb = prompt_embedding_for_digest(enriched_text)
            prompt_embeddings[str(prompt.id)] = emb
            print(f"[DEBUG] Prompt '{prompt.prompt_text}' embedding: {'OK len={}'.format(len(emb)) if emb else 'NONE — embedding failed'}")

        user_digest_items = []
        is_fallback_active = False

        print(f"[DEBUG] {len(candidate_docs)} candidate bills in window")
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

            print(f"[DEBUG] {doc.source_id} | score={best_score} | title={doc.title[:60] if doc.title else 'N/A'}")
            qualifies = best_score >= DIGEST_SCORE_THRESHOLD or is_review_bill
            if not qualifies:
                continue

            if is_review_bill and best_score < DIGEST_SCORE_THRESHOLD:
                best_score = doc.relevance_score or 50
                explanation = "Manually added to your watched review list"
            else:
                explanation = f"Semantic relevance score: {best_score}/100"

            app_detail_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents/{doc.source_id}"
            external_source_url = doc.source_url or f"https://www.congress.gov/bill/{doc.congress}th-congress/none"

            user_digest_items.append({
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
                    "action_date": doc.last_action_date.isoformat() if doc.last_action_date else start_date.isoformat(),
                    "text": doc.last_action_text or "(no action text available)",
                },
                "matched_prompt_id": str(best_prompt.id) if best_prompt else "watched",
            })

        # --- 30-Day Activity Fallback Mechanism ---
        if not user_digest_items:
            fallback_start_date = end_time.date() - timedelta(days=30)
            fallback_docs = (
                db.query(LegislativeDocument)
                .options(selectinload(LegislativeDocument.subjects))
                .filter(
                    or_(
                        LegislativeDocument.id.in_(
                            db.query(BillAction.document_id)
                            .filter(BillAction.action_date >= fallback_start_date)
                            .distinct()
                        ),
                        LegislativeDocument.last_action_date >= fallback_start_date,
                    )
                )
                .all()
            )
            if fallback_docs:
                print(f"[DEBUG] Rerunning digest pipeline with 30-day window: {len(fallback_docs)} candidate bills")
                for doc in fallback_docs:
                    if user.scope == "priority_states" and doc.source == "congress.gov":
                        continue

                    is_review_bill = doc.source_id in user_review_bills

                    best_score = -1
                    best_prompt = None

                    for prompt in matching_prompts:
                        emb = prompt_embeddings.get(str(prompt.id))
                        if emb is None:
                            exp = prompt.expanded_topics or {}
                            topics = exp.get("topics", [])
                            keywords = exp.get("keywords", [])
                            score = score_against_prompt(doc, topics, keywords)
                        else:
                            score = semantic_score(doc, emb)

                        if score > best_score:
                            best_score = score
                            best_prompt = prompt

                    qualifies = best_score >= DIGEST_SCORE_THRESHOLD or is_review_bill
                    if not qualifies:
                        continue

                    if is_review_bill and best_score < DIGEST_SCORE_THRESHOLD:
                        best_score = doc.relevance_score or 50
                        explanation = "Manually added to your watched review list"
                    else:
                        explanation = f"Semantic relevance score: {best_score}/100"

                    app_detail_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents/{doc.source_id}"
                    external_source_url = doc.source_url or f"https://www.congress.gov/bill/{doc.congress}th-congress/none"

                    user_digest_items.append({
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
                            "action_date": doc.last_action_date.isoformat() if doc.last_action_date else fallback_start_date.isoformat(),
                            "text": doc.last_action_text or "(no action text available)",
                        },
                        "matched_prompt_id": str(best_prompt.id) if best_prompt else "watched",
                    })

                if user_digest_items:
                    is_fallback_active = True

        if not user_digest_items:
            continue

        # Sort: review bills first, then by score descending
        review_items = sorted(
            [i for i in user_digest_items if i["is_review_bill"]],
            key=lambda x: x["relevance_score"], reverse=True,
        )
        relevance_items = sorted(
            [i for i in user_digest_items if not i["is_review_bill"]],
            key=lambda x: x["relevance_score"], reverse=True,
        )
        final_items = (review_items + relevance_items)[:settings.DIGEST_MAX_ITEMS]

        # Group by prompt
        prompt_groups_dict = {
            str(p.id): {"prompt_text": p.prompt_text, "items": []}
            for p in matching_prompts
        }
        watched_group: Dict[str, Any] = {"prompt_text": "Watched Bills", "items": []}

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

        payloads.append({
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
            "overall_summary": None,
            "items": final_items,
            "prompt_groups": prompt_groups,
            "is_fallback_active": is_fallback_active,
        })

    return payloads
