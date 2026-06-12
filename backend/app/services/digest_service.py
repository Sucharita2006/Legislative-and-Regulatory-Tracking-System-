from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_

from ..models import UserProfile, LegislativeDocument, BillAction
from ..config import settings
from .ai_processing import expand_prompt_to_topics, score_against_prompt

def compile_digests(db: Session, frequency: str) -> List[Dict[str, Any]]:
    """Query, score, filter, and compile email digest payloads for all verified users of a given frequency."""
    
    # 1. Retrieve all target users matching frequency and verification status
    users = db.query(UserProfile).filter(
        UserProfile.is_verified == True,
        UserProfile.frequency == frequency
    ).all()
    
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
        # Pre-expand prompt if the user has custom tracking instructions
        expanded_topics = []
        expanded_keywords = []
        has_prompt = False
        
        if user.prompt and user.prompt.strip():
            has_prompt = True
            expansion = expand_prompt_to_topics(user.prompt, db=db, user_email=user.email)
            expanded_topics = expansion.get("topics") or []
            expanded_keywords = expansion.get("keywords") or []

        user_digest_items = []
        user_review_bills = set(user.review_bills or [])

        for doc in candidate_docs:
            is_review_bill = doc.source_id in user_review_bills
            
            # Determine relevance score
            if has_prompt:
                score = score_against_prompt(doc, expanded_topics, expanded_keywords)
            else:
                score = doc.relevance_score or 0

            # Scope filtering
            # For now, all documents in the database are federal (congress.gov).
            # If user scope is 'priority_states' and the document is federal, we skip it.
            if user.scope == "priority_states" and doc.source == "congress.gov":
                continue
            
            # Score filter (bypassed if manually added to review_bills)
            if not is_review_bill and score < user.min_relevance_score:
                continue

            # Construct Match Reason metadata
            doc_topics = set(doc.relevance_topics or [])
            matched_topics = list(set(expanded_topics) & doc_topics)
            
            title_lower = (doc.title or "").lower()
            summary_lower = (doc.ai_summary or "").lower()
            matched_keywords = [
                kw for kw in expanded_keywords 
                if kw in title_lower or kw in summary_lower
            ]

            if is_review_bill:
                explanation = "Manually added to your watched review list"
            elif matched_topics:
                explanation = f"Matched interest topics: {', '.join(matched_topics)}"
            elif matched_keywords:
                explanation = f"Matches search keywords: {', '.join(matched_keywords)}"
            else:
                explanation = "Matched global animal legislation criteria"

            # Construct urls
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
                }
            })

        if not user_digest_items:
            continue

        # 5. Sorting and Limiting
        # Prioritize review bills with updates, then sort by relevance score descending
        review_items = [item for item in user_digest_items if item["is_review_bill"]]
        relevance_items = [item for item in user_digest_items if not item["is_review_bill"]]

        review_items.sort(key=lambda x: x["relevance_score"], reverse=True)
        relevance_items.sort(key=lambda x: x["relevance_score"], reverse=True)

        final_items = (review_items + relevance_items)[:settings.DIGEST_MAX_ITEMS]

        payloads.append({
            "recipient": {
                "user_id": str(user.id),
                "email": user.email,
                "frequency": user.frequency,
                "scope": user.scope
            },
            "digest_metadata": {
                "generated_at": end_time.isoformat() + "Z",
                "time_window_start": start_time.isoformat() + "Z",
                "time_window_end": end_time.isoformat() + "Z",
                "total_items": len(final_items),
                "max_items_limit": settings.DIGEST_MAX_ITEMS
            },
            "overall_summary": None, # dynamically generated overall summary deferred
            "items": final_items
        })

    return payloads
