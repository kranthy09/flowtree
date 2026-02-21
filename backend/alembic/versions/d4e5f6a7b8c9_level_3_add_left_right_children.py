"""level_3_add_left_right_children

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-20 11:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("number_nodes", sa.Column("left_child_id", sa.Integer(), nullable=True))
    op.add_column("number_nodes", sa.Column("right_child_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_number_nodes_left_child_id",
        "number_nodes",
        "number_nodes",
        ["left_child_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_number_nodes_right_child_id",
        "number_nodes",
        "number_nodes",
        ["right_child_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_number_nodes_right_child_id", "number_nodes", type_="foreignkey")
    op.drop_constraint("fk_number_nodes_left_child_id", "number_nodes", type_="foreignkey")
    op.drop_column("number_nodes", "right_child_id")
    op.drop_column("number_nodes", "left_child_id")
