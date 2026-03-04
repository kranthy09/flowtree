import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.node import FlowNode
    from app.models.workspace import Workspace


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flow_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # PENDING | RUNNING | SUCCESS | ERROR | SKIPPED
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="'PENDING'"
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── relationships ─────────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="executions"
    )
    node: Mapped["FlowNode"] = relationship(
        "FlowNode", back_populates="executions"
    )
