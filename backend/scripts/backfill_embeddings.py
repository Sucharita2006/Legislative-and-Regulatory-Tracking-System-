"""Backfill embeddings for all bills that don't have one yet.

Run from the backend/ directory:
    python -m scripts.backfill_embeddings

Options:
    --batch   Number of bills to process per commit (default: 50)
    --limit   Maximum total bills to process (default: all)
    --dry-run Print what would be done without writing to DB
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import LegislativeDocument
from app.services.semantic_scoring import store_bill_embedding, bill_text_for_embedding
from sqlalchemy.orm import selectinload


def main():
    parser = argparse.ArgumentParser(description="Backfill bill embeddings for vector search.")
    parser.add_argument("--batch", type=int, default=50, help="Bills per commit batch")
    parser.add_argument("--limit", type=int, default=0, help="Max bills (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Estimate only, no writes")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        base_q = (
            db.query(LegislativeDocument)
            .options(selectinload(LegislativeDocument.subjects))
            .filter(LegislativeDocument.embedding.is_(None))
            .order_by(LegislativeDocument.ingested_at.desc())
        )
        total_missing = base_q.count()
        cap = args.limit if args.limit > 0 else total_missing
        print(f"Bills missing embeddings: {total_missing}  |  will process: {min(total_missing, cap)}")

        if args.dry_run:
            print("Dry run — exiting without writing.")
            return

        processed = skipped = failed = 0
        batch: list[LegislativeDocument] = []

        for doc in base_q.yield_per(args.batch):
            if processed + skipped >= cap:
                break

            text = bill_text_for_embedding(doc)
            if not text.strip():
                skipped += 1
                continue

            batch.append(doc)

            if len(batch) >= args.batch:
                _flush(batch, db)
                processed += len(batch)
                print(f"  Embedded {processed}/{min(total_missing, cap)} ...", flush=True)
                batch = []

        if batch:
            _flush(batch, db)
            processed += len(batch)

        print(f"\nDone. Embedded: {processed}  Skipped (no text): {skipped}  Total: {processed + skipped}")

    finally:
        db.close()


def _flush(batch: list, db):
    """Compute and commit embeddings for a batch of docs."""
    for doc in batch:
        try:
            store_bill_embedding(doc, db)
        except Exception as e:
            print(f"  Warning: failed to embed {doc.source_id}: {e}")


if __name__ == "__main__":
    main()
