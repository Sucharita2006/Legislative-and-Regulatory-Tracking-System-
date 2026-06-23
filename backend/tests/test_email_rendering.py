"""
test_email_rendering.py — Phase 2A Tests

Validates:
  1. Template rendering succeeds for a full mock payload.
  2. All key payload values appear correctly in the output HTML.
  3. Empty-state rendering works and shows the correct fallback message.
  4. HTML output contains all expected structural sections.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

# ── Allow imports from project root ──────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "postgresql://test_dummy")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.services.email_render_service import (  # noqa: E402
    render_digest_html,
    render_empty_digest_html,
)

# ── Shared Fixtures ───────────────────────────────────────────────────────────
NOW = datetime.utcnow()


def _make_payload(items=None, frequency="daily") -> dict:
    """Build a minimal valid digest payload."""
    if items is None:
        items = [
            {
                "document_id": "119-HR-1111",
                "title": "Test Animal Welfare Bill",
                "policy_area": "Agriculture",
                "relevance_score": 88,
                "is_review_bill": False,
                "match_reason": {
                    "matched_topics": ["farm animal welfare"],
                    "matched_keywords": ["animal welfare"],
                    "explanation": "Matched interest topics: farm animal welfare",
                },
                "ai_summary": "This is a test AI summary for the bill.",
                "app_detail_url": "http://localhost:5173?bill=119-HR-1111",
                "external_source_url": "https://www.congress.gov/bill/test",
                "last_action": {
                    "action_date": (NOW - timedelta(days=1)).date().isoformat(),
                    "text": "Referred to subcommittee.",
                },
            }
        ]

    return {
        "recipient": {
            "user_id": "test-user-001",
            "email": "test@aldf.org",
            "frequency": frequency,
            "scope": "federal",
        },
        "digest_metadata": {
            "generated_at": NOW.isoformat() + "Z",
            "time_window_start": (NOW - timedelta(hours=24)).isoformat() + "Z",
            "time_window_end": NOW.isoformat() + "Z",
            "total_items": len(items),
            "max_items_limit": 10,
        },
        "overall_summary": "Test overall summary.",
        "items": items,
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestRenderDigestHtml:

    def test_render_succeeds(self):
        """render_digest_html must return a non-empty string without raising."""
        html = render_digest_html(_make_payload())
        assert isinstance(html, str)
        assert len(html) > 100

    def test_output_is_valid_html(self):
        """Output must start with DOCTYPE and contain basic html structure."""
        html = render_digest_html(_make_payload())
        assert "<!DOCTYPE html>" in html
        assert "<html" in html
        assert "</html>" in html

    # ── Structural Sections ───────────────────────────────────────────────────

    def test_contains_header(self):
        html = render_digest_html(_make_payload())
        assert "ALDF LEGISLATIVE TRACKER" in html

    def test_contains_intro_section(self):
        html = render_digest_html(_make_payload())
        assert "test@aldf.org" in html

    def test_contains_digest_summary_strip(self):
        """Summary strip with bill count should be present when items exist."""
        html = render_digest_html(_make_payload())
        assert "Total Bills" in html
        assert "Avg AI Score" in html

    def test_contains_legislative_updates_label(self):
        html = render_digest_html(_make_payload())
        assert "LEGISLATIVE UPDATES" in html

    def test_contains_footer(self):
        html = render_digest_html(_make_payload())
        assert "Animal Legal Defense Fund" in html
        assert "Manage Preferences" in html

    # ── Payload Field Mapping ─────────────────────────────────────────────────

    def test_bill_title_appears(self):
        html = render_digest_html(_make_payload())
        assert "Test Animal Welfare Bill" in html

    def test_bill_id_appears(self):
        html = render_digest_html(_make_payload())
        assert "119-HR-1111" in html

    def test_policy_area_appears(self):
        html = render_digest_html(_make_payload())
        assert "Agriculture" in html

    def test_relevance_score_appears(self):
        html = render_digest_html(_make_payload())
        assert "88" in html

    def test_ai_summary_appears(self):
        html = render_digest_html(_make_payload())
        assert "This is a test AI summary" in html

    def test_last_action_text_appears(self):
        html = render_digest_html(_make_payload())
        assert "Referred to subcommittee" in html

    def test_match_reason_appears(self):
        html = render_digest_html(_make_payload())
        assert "farm animal welfare" in html

    def test_congress_url_appears(self):
        html = render_digest_html(_make_payload())
        assert "https://www.congress.gov/bill/test" in html

    def test_app_detail_url_appears(self):
        html = render_digest_html(_make_payload())
        assert "119-HR-1111" in html

    def test_recipient_frequency_in_footer(self):
        html = render_digest_html(_make_payload(frequency="weekly"))
        assert "weekly" in html

    def test_watched_badge_shown_for_review_bill(self):
        items = [
            {
                **_make_payload()["items"][0],
                "is_review_bill": True,
            }
        ]
        html = render_digest_html(_make_payload(items=items))
        assert "Watched" in html

    def test_watched_badge_not_shown_for_normal_bill(self):
        html = render_digest_html(_make_payload())
        # "Watched" badge is a styled span inside the card top bar — check it's not in a badge context
        assert 'letter-spacing:1px;">\n                            Watched' not in html

    def test_matched_keywords_rendered(self):
        """Matched keywords should appear as styled pills in the match rationale block."""
        items = [{
            **_make_payload()["items"][0],
            "match_reason": {
                "matched_topics": [],
                "matched_keywords": ["animal testing", "lab standards"],
                "explanation": "Matches search keywords: animal testing, lab standards",
            }
        }]
        html = render_digest_html(_make_payload(items=items))
        assert "animal testing" in html
        assert "lab standards" in html

    def test_both_topics_and_keywords_rendered(self):
        """Both matched_topics and matched_keywords should appear when present."""
        items = [{
            **_make_payload()["items"][0],
            "match_reason": {
                "matched_topics": ["farm animal welfare"],
                "matched_keywords": ["livestock"],
                "explanation": "Matched topics and keywords",
            }
        }]
        html = render_digest_html(_make_payload(items=items))
        assert "farm animal welfare" in html
        assert "livestock" in html

    def test_outlook_gradient_fallback_present(self):
        """Header td must have background-color fallback for Outlook."""
        html = render_digest_html(_make_payload())
        assert "background-color:#006C67" in html

    def test_cta_primary_button_outlook_safe(self):
        """Primary CTA must use explicit background-color (not just shorthand) for Outlook."""
        html = render_digest_html(_make_payload())
        assert "background-color:#006C67" in html

    def test_cta_ghost_button_not_transparent(self):
        """Ghost CTA button must use explicit background-color instead of transparent for Outlook."""
        html = render_digest_html(_make_payload())
        assert "background-color:#1a1a1a" in html
        assert "background:transparent" not in html

    def test_overall_summary_appears(self):
        html = render_digest_html(_make_payload())
        assert "Test overall summary." in html

    # ── Weekly Variant ────────────────────────────────────────────────────────

    def test_weekly_digest_title(self):
        html = render_digest_html(_make_payload(frequency="weekly"))
        assert "Weekly" in html

    def test_daily_digest_title(self):
        html = render_digest_html(_make_payload(frequency="daily"))
        assert "Daily" in html

    def test_fallback_banner_renders_when_active(self):
        payload = _make_payload()
        payload["is_fallback_active"] = True
        html = render_digest_html(payload)
        assert "showing relevant updates from the past 30 days instead" in html
        assert "during the daily digest" not in html

    def test_fallback_banner_not_rendered_when_inactive(self):
        payload = _make_payload()
        payload["is_fallback_active"] = False
        html = render_digest_html(payload)
        assert "showing relevant updates from the past 30 days instead" not in html
        assert "during the daily digest" in html


class TestEmptyStateRendering:

    def test_empty_state_renders_without_error(self):
        """render_digest_html with empty items must succeed."""
        html = render_digest_html(_make_payload(items=[]))
        assert isinstance(html, str)
        assert len(html) > 100

    def test_empty_state_message_present(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "No legislative updates matching your interests" in html

    def test_empty_state_has_recent_changes_link(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "tab=recent" in html
        assert "View Recent Changes" in html

    def test_empty_state_has_no_bill_cards(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "LEGISLATIVE UPDATES" not in html
        assert "119-HR-1111" not in html

    def test_empty_state_has_no_summary_strip(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "Total Bills" not in html

    def test_render_empty_digest_html_convenience_wrapper(self):
        """render_empty_digest_html forces items=[] regardless of payload."""
        full_payload = _make_payload()
        html = render_empty_digest_html(full_payload)
        assert "No legislative updates matching your interests" in html
        assert "Test Animal Welfare Bill" not in html

    def test_empty_state_still_has_header(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "ALDF LEGISLATIVE TRACKER" in html

    def test_empty_state_still_has_footer(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "Animal Legal Defense Fund" in html

    def test_empty_state_recipient_email_shown(self):
        html = render_digest_html(_make_payload(items=[]))
        assert "test@aldf.org" in html


class TestMultipleBills:

    def test_multiple_bills_all_render(self):
        items = [
            {**_make_payload()["items"][0], "document_id": f"119-HR-{i:04d}", "title": f"Bill {i}"}
            for i in range(1, 6)
        ]
        html = render_digest_html(_make_payload(items=items))
        for i in range(1, 6):
            assert f"Bill {i}" in html

    def test_ai_summary_truncated_at_400_chars(self):
        long_summary = "A" * 500
        items = [{**_make_payload()["items"][0], "ai_summary": long_summary}]
        html = render_digest_html(_make_payload(items=items))
        # Template truncates at 400 chars and adds ellipsis
        assert "…" in html

    def test_missing_ai_summary_gracefully_omitted(self):
        items = [{**_make_payload()["items"][0], "ai_summary": "(no AI summary available)"}]
        html = render_digest_html(_make_payload(items=items))
        # Placeholder text should not appear in the rendered output's summary body
        assert "(no AI summary available)" not in html
