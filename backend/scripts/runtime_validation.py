#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import UserProfile, LegislativeDocument, BillAction
from app.config import settings
from app.services.digest_service import compile_digests
from app.services.ai_processing import expand_prompt_to_topics, score_against_prompt

def main():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("RUNTIME DIGEST VALIDATION")
        print("=" * 60)

        # 1. Total verified/daily/weekly users
        total_verified = db.query(UserProfile).filter(UserProfile.is_verified == True).count()
        total_daily = db.query(UserProfile).filter(UserProfile.frequency == "daily").count()
        total_daily_verified = db.query(UserProfile).filter(UserProfile.is_verified == True, UserProfile.frequency == "daily").count()
        total_weekly = db.query(UserProfile).filter(UserProfile.frequency == "weekly").count()
        total_weekly_verified = db.query(UserProfile).filter(UserProfile.is_verified == True, UserProfile.frequency == "weekly").count()

        print(f"Total Verified Users: {total_verified}")
        print(f"Total Daily Users (Verified/Total): {total_daily_verified}/{total_daily}")
        print(f"Total Weekly Users (Verified/Total): {total_weekly_verified}/{total_weekly}")

        # 2. Candidate documents in the last 24 hours / 7 days
        end_time = datetime.now()
        start_24h = end_time - timedelta(hours=settings.DIGEST_WINDOW_DAILY_HOURS)
        start_7d = end_time - timedelta(days=settings.DIGEST_WINDOW_WEEKLY_DAYS)

        date_24h = start_24h.date()
        date_7d = start_7d.date()

        docs_24h = (
            db.query(LegislativeDocument.id)
            .join(BillAction, LegislativeDocument.id == BillAction.document_id)
            .filter(BillAction.action_date >= date_24h)
            .distinct()
            .count()
        )

        docs_7d = (
            db.query(LegislativeDocument.id)
            .join(BillAction, LegislativeDocument.id == BillAction.document_id)
            .filter(BillAction.action_date >= date_7d)
            .distinct()
            .count()
        )

        print(f"Candidate documents (actions in last 24h): {docs_24h}")
        print(f"Candidate documents (actions in last 7d):  {docs_7d}")

        # 3. Simulate compiler for DAILY users and diagnose elimination stages
        print("\n" + "=" * 60)
        print("DIAGNOSTIC TRACE FOR DAILY USERS")
        print("=" * 60)

        # Retrieve daily users
        daily_users = db.query(UserProfile).filter(
            UserProfile.is_verified == True,
            UserProfile.frequency == "daily"
        ).all()

        # Retrieve daily candidate docs
        candidate_docs = (
            db.query(LegislativeDocument)
            .join(BillAction, LegislativeDocument.id == BillAction.document_id)
            .filter(BillAction.action_date >= date_24h)
            .distinct()
            .all()
        )

        if not daily_users:
            print("No verified daily users to process.")
        elif not candidate_docs:
            print("No candidate documents in the last 24h to process.")
            for user in daily_users:
                print(f"User {user.email}: Filtered out because: No recent bill activity (0 candidate docs).")
        else:
            successful_digests = 0
            for user in daily_users:
                # Track why documents are excluded for this user
                excluded_reasons = {
                    "scope_mismatch": 0,
                    "below_threshold": 0,
                    "total_candidates": len(candidate_docs)
                }

                expanded_topics = []
                expanded_keywords = []
                has_prompt = False
                
                if user.prompt and user.prompt.strip():
                    has_prompt = True
                    try:
                        expansion = expand_prompt_to_topics(user.prompt, db=db, user_email=user.email)
                        expanded_topics = expansion.get("topics") or []
                        expanded_keywords = expansion.get("keywords") or []
                    except Exception as e:
                        print(f"  Warning: failed expanding topics/keywords for {user.email}: {e}")

                user_digest_items = []
                user_review_bills = set(user.review_bills or [])

                for doc in candidate_docs:
                    is_review_bill = doc.source_id in user_review_bills
                    
                    if has_prompt:
                        score = score_against_prompt(doc, expanded_topics, expanded_keywords)
                    else:
                        score = doc.relevance_score or 0

                    if user.scope == "priority_states" and doc.source == "congress.gov":
                        excluded_reasons["scope_mismatch"] += 1
                        continue

                    if not is_review_bill and score < user.min_relevance_score:
                        excluded_reasons["below_threshold"] += 1
                        continue

                    user_digest_items.append(doc)

                if user_digest_items:
                    successful_digests += 1
                    print(f"User {user.email}: Success! Compiled {len(user_digest_items)} items.")
                else:
                    reason = "No matching documents"
                    if excluded_reasons["scope_mismatch"] == len(candidate_docs):
                        reason = "Scope filtering (all candidates mismatch)"
                    elif excluded_reasons["below_threshold"] == len(candidate_docs):
                        reason = "Relevance score threshold (all candidates below min score)"
                    elif excluded_reasons["scope_mismatch"] + excluded_reasons["below_threshold"] == len(candidate_docs):
                        reason = "Combination of Scope filtering and Relevance score threshold"
                    
                    print(f"User {user.email}: Filtered out because: {reason} "
                          f"(Scope mismatch: {excluded_reasons['scope_mismatch']}, Below score: {excluded_reasons['below_threshold']})")

            print(f"\nUsers receiving at least one matching digest: {successful_digests}")

        # 4. Simulate compiler for DAILY users using 7-DAY candidate documents (diagnostic trace)
        print("\n" + "=" * 60)
        print("DIAGNOSTIC TRACE FOR DAILY USERS (USING 7-DAY CANDIDATE DOCUMENTS)")
        print("=" * 60)

        candidate_docs_7d = (
            db.query(LegislativeDocument)
            .join(BillAction, LegislativeDocument.id == BillAction.document_id)
            .filter(BillAction.action_date >= date_7d)
            .distinct()
            .all()
        )

        if not daily_users:
            print("No verified daily users to process.")
        elif not candidate_docs_7d:
            print("No candidate documents in the last 7d to process.")
        else:
            successful_digests_7d = 0
            for user in daily_users:
                excluded_reasons = {
                    "scope_mismatch": 0,
                    "below_threshold": 0,
                    "total_candidates": len(candidate_docs_7d)
                }

                expanded_topics = []
                expanded_keywords = []
                has_prompt = False
                
                if user.prompt and user.prompt.strip():
                    has_prompt = True
                    try:
                        expansion = expand_prompt_to_topics(user.prompt, db=db, user_email=user.email)
                        expanded_topics = expansion.get("topics") or []
                        expanded_keywords = expansion.get("keywords") or []
                    except Exception as e:
                        print(f"  Warning: failed expanding topics/keywords for {user.email}: {e}")

                user_digest_items = []
                user_review_bills = set(user.review_bills or [])

                for doc in candidate_docs_7d:
                    is_review_bill = doc.source_id in user_review_bills
                    
                    if has_prompt:
                        score = score_against_prompt(doc, expanded_topics, expanded_keywords)
                    else:
                        score = doc.relevance_score or 0

                    if user.scope == "priority_states" and doc.source == "congress.gov":
                        excluded_reasons["scope_mismatch"] += 1
                        continue

                    if not is_review_bill and score < user.min_relevance_score:
                        excluded_reasons["below_threshold"] += 1
                        continue

                    user_digest_items.append((doc.source_id, score))

                if user_digest_items:
                    successful_digests_7d += 1
                    print(f"User {user.email}: Success! Compiled {len(user_digest_items)} items: {user_digest_items}")
                else:
                    reason = "No matching documents"
                    if excluded_reasons["scope_mismatch"] == len(candidate_docs_7d):
                        reason = "Scope filtering (all candidates mismatch)"
                    elif excluded_reasons["below_threshold"] == len(candidate_docs_7d):
                        reason = "Relevance score threshold (all candidates below min score)"
                    elif excluded_reasons["scope_mismatch"] + excluded_reasons["below_threshold"] == len(candidate_docs_7d):
                        reason = "Combination of Scope filtering and Relevance score threshold"
                    
                    print(f"User {user.email}: Filtered out because: {reason} "
                          f"(Scope mismatch: {excluded_reasons['scope_mismatch']}, Below score: {excluded_reasons['below_threshold']})")

            print(f"\nUsers receiving at least one matching digest (7-day window): {successful_digests_7d}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
