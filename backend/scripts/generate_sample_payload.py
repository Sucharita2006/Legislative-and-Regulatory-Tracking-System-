#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import UserProfile
from app.services.digest_service import compile_digests

def main():
    db = SessionLocal()
    try:
        # Find a verified user to use
        user = db.query(UserProfile).filter(UserProfile.is_verified == True).first()
        if not user:
            print("No verified user found in the database.")
            return

        from app.models import UserPrompt
        # Create a temp weekly prompt
        weekly_prompt = UserPrompt(
            user_id=user.id,
            prompt_text="Save the animal habitat",
            frequency="weekly",
        )
        db.add(weekly_prompt)
        db.flush()

        # Run compile_digests for weekly frequency
        payloads = compile_digests(db, "weekly")
        
        if payloads:
            print("\n=== COMPILED PAYLOAD ===")
            print(json.dumps(payloads[0], indent=2, default=str))
            print("=========================\n")
        else:
            print("No payloads compiled.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.rollback()
        db.close()

if __name__ == "__main__":
    main()
