"""level_6_add_flow_control

Revision ID: e5f6a7b8c9d0
Revises: 26721e64f36a
Create Date: 2026-02-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = '26721e64f36a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Flow control layer ────────────────────────────────────────────────
    op.add_column('number_nodes',
        sa.Column('node_role', sa.String(length=50), nullable=True))
    op.add_column('number_nodes',
        sa.Column('branch_condition', sa.String(length=20), nullable=True))

    # ── Response layer ────────────────────────────────────────────────────
    op.add_column('number_nodes',
        sa.Column('http_status_code', sa.Integer(), nullable=True))
    op.add_column('number_nodes',
        sa.Column('error_type', sa.String(length=100), nullable=True))

    # ── Execution config layer ────────────────────────────────────────────
    op.add_column('number_nodes',
        sa.Column('retry_count', sa.Integer(), nullable=False,
                  server_default='0'))
    op.add_column('number_nodes',
        sa.Column('timeout_ms', sa.Integer(), nullable=True))
    op.add_column('number_nodes',
        sa.Column('is_async', sa.Boolean(), nullable=False,
                  server_default='false'))
    op.add_column('number_nodes',
        sa.Column('sla_ms', sa.Integer(), nullable=True))

    # ── Documentation layer ───────────────────────────────────────────────
    op.add_column('number_nodes',
        sa.Column('description', sa.Text(), nullable=True))
    op.add_column('number_nodes',
        sa.Column('owner_team', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('number_nodes', 'owner_team')
    op.drop_column('number_nodes', 'description')
    op.drop_column('number_nodes', 'sla_ms')
    op.drop_column('number_nodes', 'is_async')
    op.drop_column('number_nodes', 'timeout_ms')
    op.drop_column('number_nodes', 'retry_count')
    op.drop_column('number_nodes', 'error_type')
    op.drop_column('number_nodes', 'http_status_code')
    op.drop_column('number_nodes', 'branch_condition')
    op.drop_column('number_nodes', 'node_role')
