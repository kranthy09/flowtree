from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class NumberNode(Base):
    __tablename__ = "number_nodes"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(36), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    name = Column(String(255), nullable=True)
    type = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
