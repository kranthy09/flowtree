"""level_2_add_parent_id

Revision ID: c3d4e5f6a7b8
Revises: 159443b72397
Create Date: 2026-02-20 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "159443b72397"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("number_nodes", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_number_nodes_parent_id",
        "number_nodes",
        "number_nodes",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_number_nodes_parent_id", "number_nodes", type_="foreignkey")
    op.drop_column("number_nodes", "parent_id")
