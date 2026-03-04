import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class FlowNodeSummary(BaseModel):
    """Minimal node shape returned inside a workspace detail response.
    Full NodeResponse is defined in schemas/node.py (R3.1)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    node_type: str
    parent_id: uuid.UUID | None
    position_x: float
    position_y: float


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    node_count: int = 0


class WorkspaceDetailResponse(WorkspaceResponse):
    """Returned by GET /workspaces/{id} — includes the flat node list."""

    nodes: list[FlowNodeSummary] = []
