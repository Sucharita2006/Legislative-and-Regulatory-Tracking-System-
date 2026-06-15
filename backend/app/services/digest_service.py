from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_

from ..models import UserProfile, LegislativeDocument, BillAction
from ..config import settings
from .ai_processing import expand_prompt_to_topics, score_against_prompt

def compile_digests(db: Session, frequency: str) -> List[Dict[str, Any]]:
    """Query, score, filter, and compile email digest payloads for all verified users of a given frequency."""
    
    # 1. Retrieve all verified users
    users = (
        db.query(UserProfile)
        .filter(UserProfile.is_verified == True)
        .options(selectinload(UserProfile.prompts))
        .all()
    )
    
    if not users:
        return []

    # 2. Calculate time window boundaries
    end_time = datetime.now()
    if frequency == "daily":
        start_time = end_time - timedelta(hours=settings.DIGEST_WINDOW_DAILY_HOURS)
    else:
        start_time = end_time - timedelta(days=settings.DIGEST_WINDOW_WEEKLY_DAYS)

    # 3. Retrieve all candidate documents that had actions within the time window
    start_date = start_time.date()
    candidate_docs = (
        db.query(LegislativeDocument)
        .join(BillAction, LegislativeDocument.id == BillAction.document_id)
        .options(selectinload(LegislativeDocument.subjects))
        .filter(BillAction.action_date >= start_date)
        .distinct(LegislativeDocument.id)
        .all()
    )

    if not candidate_docs:
        return []

    payloads = []

    # 4. Process matches per user
    for user in users:
        # Get prompts matching the target frequency
        matching_prompts = [p for p in user.prompts if p.frequency == frequency]
        if not matching_prompts:
            continue

        user_digest_items = []
        user_review_bills = set(user.review_bills or [])

        # Pre-cache expanded topics/keywords for each prompt
        prompt_expansions = {}
        for prompt in matching_prompts:
            expanded_topics = []
            expanded_keywords = []
            if prompt.expanded_topics:
                expanded_topics = prompt.expanded_topics.get("topics") or []
                expanded_keywords = prompt.expanded_topics.get("keywords") or []
            if not expanded_topics and not expanded_keywords and prompt.prompt_text.strip():
                try:
                    expansion = expand_prompt_to_topics(prompt.prompt_text, db=db, user_email=user.email)
                    expanded_topics = expansion.get("topics") or []
                    expanded_keywords = expansion.get("keywords") or []
                except Exception:
                    pass
            prompt_expansions[prompt.id] = {
                "topics": expanded_topics,
                "keywords": expanded_keywords
            }

        for doc in candidate_docs:
            is_review_bill = doc.source_id in user_review_bills
            
            # Scope filtering
            if user.scope == "priority_states" and doc.source == "congress.gov":
                continue

            # Evaluate matches against each matching prompt using threshold of 50
            best_prompt = None
            best_score = -1
            best_matched_topics = []
            best_matched_keywords = []

            for prompt in matching_prompts:
                exp = prompt_expansions[prompt.id]
                score = score_against_prompt(doc, exp["topics"], exp["keywords"])
                
                if score >= 50 and score > best_score:
                    best_score = score
                    best_prompt = prompt
                    
                    doc_topics = set(doc.relevance_topics or [])
                    best_matched_topics = list(set(exp["topics"]) & doc_topics)
                    
                    title_lower = (doc.title or "").lower()
                    summary_lower = (doc.ai_summary or "").lower()
                    best_matched_keywords = [
                        kw for kw in exp["keywords"]
                        if kw in title_lower or kw in summary_lower
                    ]

            # If it matches a prompt or is in the manually watched list, we include it
            if best_prompt is not None or is_review_bill:
                if best_prompt is not None:
                    score = best_score
                    matched_topics = best_matched_topics
                    matched_keywords = best_matched_keywords
                    explanation = f"Matched interest topics: {', '.join(matched_topics)}" if matched_topics else f"Matches search keywords: {', '.join(matched_keywords)}"
                    if not explanation:
                        explanation = "Matched interest prompt criteria"
                else:
                    score = doc.relevance_score or 0
                    matched_topics = []
                    matched_keywords = []
                    explanation = "Manually added to your watched review list"

                app_detail_url = f"{settings.FRONTEND_URL.rstrip('/')}/documents/{doc.source_id}"
                external_source_url = doc.source_url or f"https://www.congress.gov/bill/{doc.congress}th-congress/none"

                user_digest_items.append({
                    "document_id": doc.source_id,
                    "title": doc.title or "(untitled)",
                    "policy_area": doc.policy_area or "Animals",
                    "relevance_score": score,
                    "is_review_bill": is_review_bill,
                    "match_reason": {
                      "matched_topics": matched_topics,
                      "matched_keywords": matched_keywords,
                      "explanation": explanation
                    },
                    "ai_summary": doc.ai_summary or "(no AI summary available)",
                    "app_detail_url": app_detail_url,
                    "external_source_url": external_source_url,
                    "last_action": {
                      "action_date": doc.last_action_date.isoformat() if doc.last_action_date else start_date.isoformat(),
                      "text": doc.last_action_text or "(no action text available)"
                    },
                    "matched_prompt_id": str(best_prompt.id) if best_prompt else "watched"
                })

        if not user_digest_items:
            continue

        # 5. Sorting and Limiting
        review_items = [item for item in user_digest_items if item["is_review_bill"]]
        relevance_items = [item for item in user_digest_items if not item["is_review_bill"]]

        review_items.sort(key=lambda x: x["relevance_score"], reverse=True)
        relevance_items.sort(key=lambda x: x["relevance_score"], reverse=True)

        final_items = (review_items + relevance_items)[:settings.DIGEST_MAX_ITEMS]

        # Group items by matched prompt
        prompt_groups_dict = {str(p.id): {"prompt_text": p.prompt_text, "items": []} for p in matching_prompts}
        watched_group = {"prompt_text": "Watched Bills", "items": []}

        for item in final_items:
            pid = item.get("matched_prompt_id")
            if pid == "watched":
                watched_group["items"].append(item)
            else:
                if pid in prompt_groups_dict:
                    prompt_groups_dict[pid]["items"].append(item)

        prompt_groups = []
        for p in matching_prompts:
            group = prompt_groups_dict[str(p.id)]
            if group["items"]:
                prompt_groups.append(group)
        if watched_group["items"]:
            prompt_groups.append(watched_group)

        payloads.append({
            "recipient": {
                "user_id": str(user.id),
                "email": user.email,
                "frequency": frequency,
                "scope": user.scope
            },
            "digest_metadata": {
                "generated_at": end_time.isoformat() + "Z",
                "time_window_start": start_time.isoformat() + "Z",
                "time_window_end": end_time.isoformat() + "Z",
                "total_items": len(final_items),
                "max_items_limit": settings.DIGEST_MAX_ITEMS
            },
            "overall_summary": None,
            "items": final_items,
            "prompt_groups": prompt_groups
        })

    return payloads
