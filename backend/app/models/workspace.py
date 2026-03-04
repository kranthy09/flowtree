import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.execution import Execution
    from app.models.node import FlowNode


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    nodes: Mapped[list["FlowNode"]] = relationship(
        "FlowNode",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    executions: Mapped[list["Execution"]] = relationship(
        "Execution",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
