#!/usr/bin/env python3
"""
send_test_email.py — Phase 2B Standalone Developer Sending Script

Sends a fully rendered mock digest email to a specified destination.
Does not perform any live database queries.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# ── Allow imports from project root ──────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from backend.app.services.email_render_service import render_digest_html
from backend.app.services.email_delivery_service import send_html_email
from backend.scripts.preview_digest_html import _build_mock_payload

async def async_main() -> None:
    parser = argparse.ArgumentParser(
        description="Send a fully rendered mock digest email to a specified recipient."
    )
    parser.add_argument(
        "--to",
        required=True,
        help="Recipient email address to deliver to."
    )
    parser.add_argument(
        "--frequency",
        default="daily",
        choices=["daily", "weekly"],
        help="Mock payload frequency variant (default: daily)."
    )

    args = parser.parse_args()

    print(f"Generating mock {args.frequency} payload...")
    payload = _build_mock_payload(args.frequency)
    
    # Override recipient email with the command line input
    payload["recipient"]["email"] = args.to

    print("Rendering HTML email from template...")
    html_content = render_digest_html(payload)

    subject = f"ALDF Test {args.frequency.capitalize()} Digest"
    print(f"Delivering HTML email to {args.to} via SMTP...")
    try:
        await send_html_email(args.to, subject, html_content)
        print("✓ Success! Email sent successfully.")
    except Exception as e:
        print(f"✗ Error: Failed to send email: {e}", file=sys.stderr)
        sys.exit(1)

def main() -> None:
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
