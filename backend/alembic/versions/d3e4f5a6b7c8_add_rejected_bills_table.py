"""add_rejected_bills_table

Revision ID: d3e4f5a6b7c8
Revises: c7d8e9f0a1b2
Create Date: 2026-07-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('rejected_bills',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('source_id', sa.String(length=100), nullable=False),
    sa.Column('congress', sa.Integer(), nullable=False),
    sa.Column('bill_type', sa.String(length=20), nullable=False),
    sa.Column('bill_number', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.String(length=20), nullable=False),
    sa.Column('relevance_score', sa.Integer(), nullable=True),
    sa.Column('last_seen_update_date', sa.DateTime(), nullable=True),
    sa.Column('rejected_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source_id', name='uq_rejected_bills_source_id')
    )
    op.create_index(op.f('ix_rejected_bills_source_id'), 'rejected_bills', ['source_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rejected_bills_source_id'), table_name='rejected_bills')
    op.drop_table('rejected_bills')
