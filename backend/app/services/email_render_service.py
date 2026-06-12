"""
Email Render Service — Phase 2A

Renders digest payloads into responsive HTML emails using Jinja2 templates.
No email sending is performed here.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..config import settings

# ── Template Environment ──────────────────────────────────────────────────────
_TEMPLATE_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


# ── Public API ────────────────────────────────────────────────────────────────

def render_digest_html(payload: Dict[str, Any]) -> str:
    """
    Accept a digest payload (as produced by digest_service.compile_digests)
    and return a fully rendered HTML string ready for email delivery.

    Parameters
    ----------
    payload : dict
        Must follow the schema:
        {
            "recipient":         { "email", "frequency", "scope", ... },
            "digest_metadata":   { "generated_at", "time_window_start",
                                   "time_window_end", "total_items", ... },
            "overall_summary":   str | None,
            "items":             [ { bill fields } ]
        }

    Returns
    -------
    str
        Rendered HTML string.
    """
    template = _jinja_env.get_template("digest_email.html")

    recipient = payload.get("recipient", {})
    items = payload.get("items", [])
    frequency = recipient.get("frequency", "daily")

    # Derive human-readable labels
    period_label = "Daily Digest" if frequency == "daily" else "Weekly Digest"
    digest_title = (
        "Your Daily Legislative Briefing"
        if frequency == "daily"
        else "Your Weekly Legislative Briefing"
    )

    # Preheader — shown in inbox preview line
    if items:
        preheader_text = (
            f"{len(items)} legislative update{'s' if len(items) != 1 else ''} "
            f"matching your interests."
        )
    else:
        preheader_text = "No new updates this period — check back soon."

    ctx: Dict[str, Any] = {
        "subject": f"ALDF {period_label} — {payload.get('digest_metadata', {}).get('generated_at', '')[:10]}",
        "preheader_text": preheader_text,
        "digest_title": digest_title,
        "period_label": period_label,
        "recipient": recipient,
        "digest_metadata": payload.get("digest_metadata", {}),
        "overall_summary": payload.get("overall_summary"),
        "items": items,
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
    }

    return template.render(**ctx)


def render_empty_digest_html(payload: Dict[str, Any]) -> str:
    """
    Convenience wrapper — forces items to empty so the empty-state
    section is always rendered, regardless of payload content.
    Useful for testing the empty-state branch directly.
    """
    empty_payload = {**payload, "items": []}
    return render_digest_html(empty_payload)
