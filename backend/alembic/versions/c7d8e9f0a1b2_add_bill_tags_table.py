"""add_bill_tags_table

Revision ID: c7d8e9f0a1b2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('bill_tags',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('tag_name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user_profiles.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['document_id'], ['legislative_documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'document_id', 'tag_name', name='uq_bill_tags_user_document_tag')
    )
    op.create_index(op.f('ix_bill_tags_user_id'), 'bill_tags', ['user_id'], unique=False)
    op.create_index(op.f('ix_bill_tags_document_id'), 'bill_tags', ['document_id'], unique=False)
    op.create_index(op.f('ix_bill_tags_tag_name'), 'bill_tags', ['tag_name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_bill_tags_tag_name'), table_name='bill_tags')
    op.drop_index(op.f('ix_bill_tags_document_id'), table_name='bill_tags')
    op.drop_index(op.f('ix_bill_tags_user_id'), table_name='bill_tags')
    op.drop_table('bill_tags')
