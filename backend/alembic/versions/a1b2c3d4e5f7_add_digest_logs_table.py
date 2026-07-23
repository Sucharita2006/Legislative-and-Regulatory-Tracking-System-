"""add_digest_logs_table

Revision ID: a1b2c3d4e5f7
Revises: 0fe3c9983e8e
Create Date: 2026-07-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = '0fe3c9983e8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'digest_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('user_profiles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('prompt_id', UUID(as_uuid=True), sa.ForeignKey('user_prompts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('items_count', sa.Integer, server_default='0'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('sent_at', sa.DateTime, server_default=sa.text('now()'), index=True),
    )


def downgrade() -> None:
    op.drop_table('digest_logs')
