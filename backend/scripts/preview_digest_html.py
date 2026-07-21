#!/usr/bin/env python
"""
preview_digest_html.py — Phase 2A Preview Tooling

Generates a local preview.html file for visual inspection of the digest email.

Usage
-----
# Render with built-in mock payload:
    python backend/scripts/preview_digest_html.py --mock

# Render for a real user (requires live DB):
    python backend/scripts/preview_digest_html.py --user user@example.com

Output
------
Creates  preview.html  in the current working directory.
Open it in any browser to inspect desktop and mobile layouts.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ── Allow imports from project root ──────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

os.environ.setdefault("CONGRESS_API_KEY", "preview_dummy")
os.environ.setdefault("DATABASE_URL",     "postgresql://preview_dummy")
os.environ.setdefault("OPENROUTER_API_KEY", "preview_dummy")

from backend.app.services.email_render_service import render_digest_html  # noqa: E402

# ── Mock Payload ──────────────────────────────────────────────────────────────
def _build_mock_payload(frequency: str = "daily") -> dict:
    now = datetime.utcnow()
    window_hours = 24 if frequency == "daily" else 24 * 7

    payload = {
        "recipient": {
            "user_id": "mock-user-uuid-0001",
            "email": "preview@aldf.org",
            "frequency": frequency,
            "scope": "federal",
        },
        "digest_metadata": {
            "generated_at": now.isoformat() + "Z",
            "time_window_start": (now - timedelta(hours=window_hours)).isoformat() + "Z",
            "time_window_end": now.isoformat() + "Z",
            "total_items": 4,
            "max_items_limit": 10,
        },
        "overall_summary": (
            "Four bills with animal welfare and wildlife protection implications moved forward this period, "
            "including new legislation on cosmetics safety, wildlife habitat, and pandemic prevention."
        ),
        "items": [
            {
                "document_id": "119-HR-4521",
                "title": "Animal Welfare and Farm Practices Oversight Act of 2025",
                "policy_area": "Agriculture",
                "relevance_score": 92,
                "is_review_bill": True,
                "match_reason": {
                    "matched_topics": ["farm animal welfare", "livestock protection"],
                    "matched_keywords": ["animal welfare", "farm practices"],
                    "explanation": "Matched interest topics: farm animal welfare, livestock protection",
                },
                "ai_summary": (
                    "This bill amends the Animal Welfare Act to extend protections to farm animals "
                    "raised for food, requiring annual inspections of commercial livestock facilities "
                    "with more than 500 animals. It directs USDA to issue updated space and care "
                    "standards within 18 months. Strongly relevant to ALDF's farm animal advocacy priorities."
                ),
                "app_detail_url": "http://localhost:5173?tab=recent&bill=119-HR-4521",
                "external_source_url": "https://www.congress.gov/bill/119th-congress/house-bill/4521",
                "last_action": {
                    "action_date": (now - timedelta(days=1)).date().isoformat(),
                    "text": "Passed committee with amendments; referred to full House floor for vote.",
                },
            },
            {
                "document_id": "119-S-1892",
                "title": "Endangered Species Habitat Preservation and Anti-Poaching Act",
                "policy_area": "Environment",
                "relevance_score": 78,
                "is_review_bill": False,
                "match_reason": {
                    "matched_topics": ["wildlife protection", "endangered species"],
                    "matched_keywords": ["endangered species", "habitat"],
                    "explanation": "Matches search keywords: endangered species, habitat",
                },
                "ai_summary": (
                    "Establishes new federal anti-poaching enforcement units and increases criminal penalties "
                    "for trafficking of endangered species. Allocates $45M over 5 years for habitat "
                    "preservation grants to qualifying non-profits. Relevant to wildlife protection work."
                ),
                "app_detail_url": "http://localhost:5173?tab=recent&bill=119-S-1892",
                "external_source_url": "https://www.congress.gov/bill/119th-congress/senate-bill/1892",
                "last_action": {
                    "action_date": (now - timedelta(days=2)).date().isoformat(),
                    "text": "Read twice and referred to the Committee on Environment and Public Works.",
                },
            },
            {
                "document_id": "119-HR-1234",
                "title": "Humane Cosmetics Act of 2025",
                "policy_area": "Commerce",
                "relevance_score": 85,
                "is_review_bill": False,
                "match_reason": {
                    "matched_topics": ["animal testing", "cosmetics safety"],
                    "matched_keywords": ["cosmetics", "animal testing"],
                    "explanation": "Matched interest topics: animal testing, cosmetics safety",
                },
                "ai_summary": (
                    "Phases out the use of live animals in cosmetics testing within U.S. jurisdictions, "
                    "prohibiting the sale or transport of cosmetics tested on animals after January 2026. "
                    "Promotes validated alternative testing methods."
                ),
                "app_detail_url": "http://localhost:5173?tab=recent&bill=119-HR-1234",
                "external_source_url": "https://www.congress.gov/bill/119th-congress/house-bill/1234",
                "last_action": {
                    "action_date": (now - timedelta(days=3)).date().isoformat(),
                    "text": "Referred to the Subcommittee on Health.",
                },
            },
            {
                "document_id": "119-S-5678",
                "title": "Preventing Future Pandemics Act of 2025",
                "policy_area": "Foreign Relations",
                "relevance_score": 70,
                "is_review_bill": False,
                "match_reason": {
                    "matched_topics": ["wildlife trafficking", "wet markets"],
                    "matched_keywords": ["wildlife market", "zoonotic disease"],
                    "explanation": "Matches search keywords: wildlife market, zoonotic disease",
                },
                "ai_summary": (
                    "Addresses public health concerns by establishing international bans on commercial "
                    "wildlife markets and wildlife trafficking. Incentivizes transition of wild animal "
                    "markets to sustainable food sources to prevent zoonotic outbreaks."
                ),
                "app_detail_url": "http://localhost:5173?tab=recent&bill=119-S-5678",
                "external_source_url": "https://www.congress.gov/bill/119th-congress/senate-bill/5678",
                "last_action": {
                    "action_date": (now - timedelta(days=4)).date().isoformat(),
                    "text": "Committee on Foreign Relations. Hearings held.",
                },
            },
        ],
    }

    # Add prompt groups
    payload["prompt_groups"] = [
        {
            "prompt_text": "Prompt 1",
            "items": [payload["items"][0], payload["items"][1]]
        },
        {
            "prompt_text": "Prompt 2",
            "items": [payload["items"][2], payload["items"][3]]
        }
    ]
    return payload


def _build_empty_mock_payload(frequency: str = "daily") -> dict:
    """Same structure but with no items — renders the empty-state."""
    payload = _build_mock_payload(frequency)
    payload["items"] = []
    payload["prompt_groups"] = []
    payload["digest_metadata"]["total_items"] = 0
    payload["overall_summary"] = None
    return payload


# ── Real-user payload (requires live DB) ────────────────────────────────────
def _build_real_payload(email: str) -> dict:
    from backend.app.database import SessionLocal
    from backend.app.services.digest_service import compile_digests
    from backend.app.models import UserProfile

    db = SessionLocal()
    try:
        user = db.query(UserProfile).filter(UserProfile.email == email).first()
        if not user:
            print(f"[preview] No user found with email: {email}")
            sys.exit(1)

        frequency = "daily"
        if user.prompts:
            frequency = user.prompts[0].frequency

        payloads = compile_digests(db, frequency=frequency)
        matched = [p for p in payloads if p["recipient"]["email"] == email]
        if not matched:
            print(f"[preview] No digest payload compiled for {email} — using empty-state mock.")
            return _build_empty_mock_payload(frequency)

        return matched[0]
    finally:
        db.close()


# ── Entry point ───────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a local preview.html of the digest email."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--mock",  action="store_true", help="Use built-in mock payload")
    group.add_argument("--user",  metavar="EMAIL",      help="Render for a real user (requires live DB)")
    parser.add_argument("--empty",     action="store_true",  help="Force empty-state rendering (use with --mock)")
    parser.add_argument("--fallback",  action="store_true",  help="Force 30-day fallback active state (use with --mock)")
    parser.add_argument("--frequency", default="daily", choices=["daily", "weekly"], help="Digest frequency for mock")
    parser.add_argument("--out",       default="preview.html", help="Output file path (default: preview.html)")

    args = parser.parse_args()

    # Build payload
    if args.mock:
        payload = _build_empty_mock_payload(args.frequency) if args.empty else _build_mock_payload(args.frequency)
        if args.fallback:
            payload["is_fallback_active"] = True
        mode = "empty-state mock" if args.empty else "mock"
    else:
        payload = _build_real_payload(args.user)
        mode = f"real user ({args.user})"

    # Render
    html = render_digest_html(payload)

    out_path = Path(args.out)
    out_path.write_text(html, encoding="utf-8")

    print(f"[preview] Rendered {mode} digest -> {out_path.resolve()}")
    print(f"[preview] {len(payload['items'])} bill(s) in payload.")
    print(f"[preview] Open in browser: file://{out_path.resolve()}")


if __name__ == "__main__":
    main()
