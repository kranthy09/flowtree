import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.execution import Execution
    from app.models.workspace import Workspace


class FlowNode(Base):
    __tablename__ = "flow_nodes"

    # ── identity ──────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    node_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # api|endpoint|request|response|field|model|step
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")

    # ── tree position ─────────────────────────────────────────────
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flow_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    position_x: Mapped[float] = mapped_column(Float, server_default="0")
    position_y: Mapped[float] = mapped_column(Float, server_default="0")

    # ── API root ──────────────────────────────────────────────────
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tech_stack: Mapped[str | None] = mapped_column(Text, nullable=True)
    architecture_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_scheme: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── ENDPOINT ─────────────────────────────────────────────────
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    operation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deprecated: Mapped[bool] = mapped_column(Boolean, server_default="false")
    query_params: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")
    service_method: Mapped[str | None] = mapped_column(String(255), nullable=True)
    database_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")
    is_async: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # ── REQUEST / RESPONSE ────────────────────────────────────────
    content_type: Mapped[str] = mapped_column(
        String(100), server_default="'application/json'"
    )
    model_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    example: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    validation_rules: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_error: Mapped[bool] = mapped_column(Boolean, server_default="false")
    error_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── FIELD ─────────────────────────────────────────────────────
    field_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    field_format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, server_default="true")
    nullable_field: Mapped[bool] = mapped_column(
        "nullable_field", Boolean, server_default="false"
    )
    read_only: Mapped[bool] = mapped_column(Boolean, server_default="false")
    write_only: Mapped[bool] = mapped_column(Boolean, server_default="false")
    default_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    items_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    items_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    constraints: Mapped[dict] = mapped_column(JSONB, server_default="'{}'::jsonb")
    field_example: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── MODEL ─────────────────────────────────────────────────────
    base_class: Mapped[str | None] = mapped_column(String(100), nullable=True)
    orm_table: Mapped[str | None] = mapped_column(String(100), nullable=True)
    indexes: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")

    # ── STEP ──────────────────────────────────────────────────────
    language: Mapped[str] = mapped_column(String(20), server_default="'python'")
    code: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_keys: Mapped[list] = mapped_column(JSONB, server_default="'[]'::jsonb")
    output_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── timestamps ────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # ── relationships ─────────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="nodes"
    )
    parent: Mapped["FlowNode | None"] = relationship(
        "FlowNode",
        remote_side="FlowNode.id",
        foreign_keys=[parent_id],
        back_populates="children",
    )
    children: Mapped[list["FlowNode"]] = relationship(
        "FlowNode",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    executions: Mapped[list["Execution"]] = relationship(
        "Execution",
        back_populates="node",
        cascade="all, delete-orphan",
    )
