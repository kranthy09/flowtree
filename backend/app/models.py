from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
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

    parent = relationship("NumberNode", remote_side=[id], foreign_keys=[parent_id])
    left_child = relationship("NumberNode", foreign_keys=[left_child_id], remote_side=[id], uselist=False)
    right_child = relationship("NumberNode", foreign_keys=[right_child_id], remote_side=[id], uselist=False)
