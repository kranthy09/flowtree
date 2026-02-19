"""initial_number_nodes

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-02-20 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "number_nodes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_number_nodes_id"), "number_nodes", ["id"], unique=False)
    op.create_index(
        op.f("ix_number_nodes_workspace_id"), "number_nodes", ["workspace_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_number_nodes_workspace_id"), table_name="number_nodes")
    op.drop_index(op.f("ix_number_nodes_id"), table_name="number_nodes")
    op.drop_table("number_nodes")
