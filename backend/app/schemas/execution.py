import uuid
from datetime import datetime

from pydantic import BaseModel


class RunRequest(BaseModel):
    initial_context: dict = {}
    node_id: uuid.UUID | None = None  # if set, run only this node


class RunResponse(BaseModel):
    run_id: uuid.UUID
    status: str  # always "queued"
    task_id: str


class ExecutionDetail(BaseModel):
    node_id: uuid.UUID
    node_name: str
    status: str
    input_data: dict | None
    output_data: dict | None
    error_message: str | None
    duration_ms: int | None


class RunSummary(BaseModel):
    run_id: uuid.UUID
    workspace_id: uuid.UUID
    status: str  # "running" | "completed" | "error"
    created_at: datetime


class RunDetail(BaseModel):
    run_id: uuid.UUID
    workspace_id: uuid.UUID
    status: str
    executions: list[ExecutionDetail]
    created_at: datetime
