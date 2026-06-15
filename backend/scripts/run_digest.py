#!/usr/bin/env python3
import sys
import os
import argparse
import json
import asyncio
from pathlib import Path

# Add parent directory to path so we can import from app
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from backend.app.database import SessionLocal
from backend.app.services.digest_service import compile_digests

async def send_digests(payloads, frequency):
    from backend.app.services.email_render_service import render_digest_html
    from backend.app.services.email_delivery_service import send_html_email
    
    for payload in payloads:
        recipient_email = payload["recipient"]["email"]
        print(f"Rendering digest for {recipient_email}...")
        html_content = render_digest_html(payload)
        subject = f"ALDF {frequency.capitalize()} Digest — {payload['digest_metadata']['generated_at'][:10]}"
        
        print(f"Sending to {recipient_email}...")
        try:
            await send_html_email(recipient_email, subject, html_content)
            print(f"✓ Sent successfully to {recipient_email}")
        except Exception as send_err:
            print(f"✗ Failed sending to {recipient_email}: {send_err}", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser(description="Run the Phase 1 & 2B Email Digest Pipeline.")
    parser.add_argument(
        "--frequency",
        choices=["daily", "weekly"],
        required=True,
        help="Specify the digest frequency ('daily' or 'weekly')."
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Optional path to a file where JSON output should be saved. If omitted, prints to stdout."
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="Render and send emails to target users via SMTP."
    )

    args = parser.parse_args()

    db = SessionLocal()
    try:
        payloads = compile_digests(db, args.frequency)
        
        if args.send:
            if not payloads:
                print("No digests compiled. Skipping delivery.")
            else:
                asyncio.run(send_digests(payloads, args.frequency))
        else:
            json_output = json.dumps(payloads, indent=2, default=str)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    f.write(json_output)
                print(f"Successfully wrote {len(payloads)} digest payloads to {args.output}")
            else:
                print(json_output)
            
    except Exception as e:
        print(f"Error running digest pipeline: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
