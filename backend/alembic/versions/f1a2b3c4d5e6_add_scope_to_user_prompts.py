"""add_scope_to_user_prompts

Revision ID: f1a2b3c4d5e6
Revises: e8e7855764e5
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'a9f3b2c1d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_prompts',
        sa.Column('scope', sa.String(length=20), nullable=False, server_default='federal'),
    )
    # Seed from the parent user's scope so existing prompts inherit their current setting
    op.execute(
        "UPDATE user_prompts p "
        "SET scope = u.scope "
        "FROM user_profiles u "
        "WHERE p.user_id = u.id"
    )


def downgrade() -> None:
    op.drop_column('user_prompts', 'scope')
