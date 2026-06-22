"""add_pgvector_embeddings

Revision ID: a9f3b2c1d4e5
Revises: 34849fb626ca
Create Date: 2026-06-22

Enable the pgvector extension and add an embedding column to
legislative_documents. The ivfflat index enables fast approximate
nearest-neighbour search once the table has enough rows; it is
created with lists=100 which suits tens of thousands of bills.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9f3b2c1d4e5"
down_revision: Union[str, Sequence[str], None] = "34849fb626ca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        "ALTER TABLE legislative_documents "
        "ADD COLUMN IF NOT EXISTS embedding vector(1536)"
    )
    # ivfflat index for cosine ANN search.
    # Build only after the backfill populates embeddings; harmless if empty now.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_legislative_documents_embedding "
        "ON legislative_documents "
        "USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS ix_legislative_documents_embedding"
    )
    op.execute(
        "ALTER TABLE legislative_documents DROP COLUMN IF EXISTS embedding"
    )
