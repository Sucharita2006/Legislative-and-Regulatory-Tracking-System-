#!/usr/bin/env python3
import sys
import os
import argparse
import json

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.services.digest_service import compile_digests

def main():
    parser = argparse.ArgumentParser(description="Run the Phase 1 Email Digest Pipeline.")
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

    args = parser.parse_args()

    db = SessionLocal()
    try:
        payloads = compile_digests(db, args.frequency)
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
