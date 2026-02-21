from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class NumberNode(Base):
    __tablename__ = "number_nodes"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(36), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    name = Column(String(255), nullable=True)
    type = Column(String(50), nullable=True)
    parent_id = Column(Integer, ForeignKey("number_nodes.id", ondelete="SET NULL"), nullable=True)
    left_child_id = Column(Integer, ForeignKey("number_nodes.id", ondelete="SET NULL"), nullable=True)
    right_child_id = Column(Integer, ForeignKey("number_nodes.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    service_method = Column(String(255), nullable=True)
    database_query = Column(Text, nullable=True)
    external_api_call = Column(String(255), nullable=True)
    condition = Column(String(500), nullable=True)
    input_schema = Column(JSON, nullable=True)
    output_schema = Column(JSON, nullable=True)

    parent = relationship("NumberNode", remote_side=[id], foreign_keys=[parent_id])
    left_child = relationship("NumberNode", foreign_keys=[left_child_id], remote_side=[id], uselist=False)
    right_child = relationship("NumberNode", foreign_keys=[right_child_id], remote_side=[id], uselist=False)
