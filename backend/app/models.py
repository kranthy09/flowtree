from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, JSON, String, Text, func,
)
from sqlalchemy.orm import DeclarativeBase, backref, relationship


class Base(DeclarativeBase):
    pass


class NumberNode(Base):
    __tablename__ = "number_nodes"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(36), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    name = Column(String(255), nullable=True)
    type = Column(String(50), nullable=True)
    parent_id = Column(
        Integer,
        ForeignKey("number_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    left_child_id = Column(
        Integer,
        ForeignKey("number_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    right_child_id = Column(
        Integer,
        ForeignKey("number_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Level 4: Business logic ───────────────────────────────────────────
    service_method = Column(String(255), nullable=True)
    database_query = Column(Text, nullable=True)
    external_api_call = Column(String(255), nullable=True)
    condition = Column(String(500), nullable=True)
    input_schema = Column(JSON, nullable=True)
    output_schema = Column(JSON, nullable=True)

    # ── Level 6: Flow control ─────────────────────────────────────────────
    node_role = Column(String(50), nullable=True)
    # values: start | process | decision | terminal | error
    branch_condition = Column(String(20), nullable=True)
    # values: success | failure | always  (None == 'always' at runtime)

    # ── Level 6: Response layer ───────────────────────────────────────────
    http_status_code = Column(Integer, nullable=True)
    error_type = Column(String(100), nullable=True)

    # ── Level 6: Execution config ─────────────────────────────────────────
    retry_count = Column(
        Integer, nullable=False, server_default="0"
    )
    timeout_ms = Column(Integer, nullable=True)
    is_async = Column(
        Boolean, nullable=False, server_default="false"
    )
    sla_ms = Column(Integer, nullable=True)

    # ── Level 6: Documentation ────────────────────────────────────────────
    description = Column(Text, nullable=True)
    owner_team = Column(String(100), nullable=True)

    parent = relationship(
        "NumberNode",
        remote_side=[id],
        foreign_keys=[parent_id],
    )
    left_child = relationship(
        "NumberNode",
        foreign_keys=[left_child_id],
        remote_side=[id],
        uselist=False,
    )
    right_child = relationship(
        "NumberNode",
        foreign_keys=[right_child_id],
        remote_side=[id],
        uselist=False,
    )


class Execution(Base):
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(36), nullable=False, index=True)
    run_id = Column(String(36), nullable=False, index=True)
    node_id = Column(
        Integer,
        ForeignKey("number_nodes.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(String(20), nullable=False, default="PENDING")
    duration_ms = Column(Integer, nullable=True)
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    node = relationship(
        "NumberNode",
        backref=backref("executions", passive_deletes=True),
    )
