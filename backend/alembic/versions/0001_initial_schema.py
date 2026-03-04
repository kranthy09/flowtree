"""Initial schema: workspaces, flow_nodes, executions

Revision ID: 0001
Revises:
Create Date: 2026-03-03

Creates three tables:
  - workspaces      (new)
  - flow_nodes      (new)  — replaces number_nodes for the new stack
  - executions      (new)  — node_id references flow_nodes

Existing tables (number_nodes, old executions) are left untouched so that
any running instance of the old stack is not broken.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── workspaces ────────────────────────────────────────────────
    op.create_table(
        "workspaces",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # ── flow_nodes ────────────────────────────────────────────────
    op.create_table(
        "flow_nodes",
        # identity
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("node_type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "tags",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        # tree
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flow_nodes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("position_x", sa.Float, server_default="0", nullable=False),
        sa.Column("position_y", sa.Float, server_default="0", nullable=False),
        # API
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("version", sa.String(20), nullable=True),
        sa.Column("base_url", sa.String(500), nullable=True),
        sa.Column("tech_stack", sa.Text, nullable=True),
        sa.Column("architecture_notes", sa.Text, nullable=True),
        sa.Column("auth_scheme", sa.String(100), nullable=True),
        # ENDPOINT
        sa.Column("method", sa.String(10), nullable=True),
        sa.Column("path", sa.String(500), nullable=True),
        sa.Column("summary", sa.String(500), nullable=True),
        sa.Column("operation_id", sa.String(255), nullable=True),
        sa.Column("deprecated", sa.Boolean, server_default="false", nullable=False),
        sa.Column(
            "query_params",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("service_method", sa.String(255), nullable=True),
        sa.Column("database_query", sa.Text, nullable=True),
        sa.Column(
            "conditions",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("is_async", sa.Boolean, server_default="true", nullable=False),
        # REQUEST / RESPONSE
        sa.Column(
            "content_type",
            sa.String(100),
            server_default="'application/json'",
            nullable=False,
        ),
        sa.Column("model_ref", sa.String(255), nullable=True),
        sa.Column("example", postgresql.JSONB, nullable=True),
        sa.Column(
            "validation_rules",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("is_error", sa.Boolean, server_default="false", nullable=False),
        sa.Column("error_type", sa.String(100), nullable=True),
        # FIELD
        sa.Column("field_type", sa.String(20), nullable=True),
        sa.Column("field_format", sa.String(50), nullable=True),
        sa.Column("required", sa.Boolean, server_default="true", nullable=False),
        sa.Column("nullable_field", sa.Boolean, server_default="false", nullable=False),
        sa.Column("read_only", sa.Boolean, server_default="false", nullable=False),
        sa.Column("write_only", sa.Boolean, server_default="false", nullable=False),
        sa.Column("default_value", postgresql.JSONB, nullable=True),
        sa.Column("items_type", sa.String(20), nullable=True),
        sa.Column("items_ref", sa.String(255), nullable=True),
        sa.Column("object_ref", sa.String(255), nullable=True),
        sa.Column(
            "constraints",
            postgresql.JSONB,
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("field_example", postgresql.JSONB, nullable=True),
        # MODEL
        sa.Column("base_class", sa.String(100), nullable=True),
        sa.Column("orm_table", sa.String(100), nullable=True),
        sa.Column(
            "indexes",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        # STEP
        sa.Column(
            "language", sa.String(20), server_default="'python'", nullable=False
        ),
        sa.Column("code", sa.Text, nullable=True),
        sa.Column(
            "input_keys",
            postgresql.JSONB,
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("output_key", sa.String(255), nullable=True),
        # timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_flow_nodes_workspace_id", "flow_nodes", ["workspace_id"])
    op.create_index("ix_flow_nodes_parent_id", "flow_nodes", ["parent_id"])

    # ── executions ────────────────────────────────────────────────
    op.create_table(
        "executions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flow_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            server_default="'PENDING'",
            nullable=False,
        ),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("input_data", postgresql.JSONB, nullable=True),
        sa.Column("output_data", postgresql.JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_executions_workspace_id", "executions", ["workspace_id"])
    op.create_index("ix_executions_run_id", "executions", ["run_id"])
    op.create_index("ix_executions_node_id", "executions", ["node_id"])


def downgrade() -> None:
    op.drop_table("executions")
    op.drop_table("flow_nodes")
    op.drop_table("workspaces")
