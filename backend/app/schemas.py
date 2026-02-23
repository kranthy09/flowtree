from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

_VALID_TYPES = ("input", "process", "output")
_VALID_NODE_ROLES = ("start", "process", "decision", "terminal", "error")
_VALID_BRANCH_CONDITIONS = ("success", "failure", "always")


class NodeCreate(BaseModel):
    value: int
    name: str | None = None
    type: str | None = None
    parent_id: int | None = None
    left_child_id: int | None = None
    right_child_id: int | None = None
    # Level 4 — business logic
    service_method: str | None = None
    database_query: str | None = None
    external_api_call: str | None = None
    condition: str | None = None
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    # Level 6 — flow control
    node_role: str | None = None
    branch_condition: str | None = None
    # Level 6 — response layer
    http_status_code: int | None = None
    error_type: str | None = None
    # Level 6 — execution config
    retry_count: int = 0
    timeout_ms: int | None = None
    is_async: bool = False
    sla_ms: int | None = None
    # Level 6 — documentation
    description: str | None = None
    owner_team: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError(
                "type must be 'input', 'process', or 'output'"
            )
        return v

    @field_validator("node_role")
    @classmethod
    def validate_node_role(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_NODE_ROLES:
            raise ValueError(
                f"node_role must be one of {_VALID_NODE_ROLES}"
            )
        return v

    @field_validator("branch_condition")
    @classmethod
    def validate_branch_condition(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_BRANCH_CONDITIONS:
            raise ValueError(
                "branch_condition must be one of "
                f"{_VALID_BRANCH_CONDITIONS}"
            )
        return v


class NodeUpdate(BaseModel):
    value: int | None = None
    name: str | None = None
    type: str | None = None
    parent_id: int | None = None
    left_child_id: int | None = None
    right_child_id: int | None = None
    # Level 4 — business logic
    service_method: str | None = None
    database_query: str | None = None
    external_api_call: str | None = None
    condition: str | None = None
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    # Level 6 — flow control
    node_role: str | None = None
    branch_condition: str | None = None
    # Level 6 — response layer
    http_status_code: int | None = None
    error_type: str | None = None
    # Level 6 — execution config (None = not provided in this PATCH)
    retry_count: int | None = None
    timeout_ms: int | None = None
    is_async: bool | None = None
    sla_ms: int | None = None
    # Level 6 — documentation
    description: str | None = None
    owner_team: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError(
                "type must be 'input', 'process', or 'output'"
            )
        return v

    @field_validator("node_role")
    @classmethod
    def validate_node_role(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_NODE_ROLES:
            raise ValueError(
                f"node_role must be one of {_VALID_NODE_ROLES}"
            )
        return v

    @field_validator("branch_condition")
    @classmethod
    def validate_branch_condition(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_BRANCH_CONDITIONS:
            raise ValueError(
                "branch_condition must be one of "
                f"{_VALID_BRANCH_CONDITIONS}"
            )
        return v


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: int
    name: str | None = None
    type: str | None = None
    parent_id: int | None = None
    left_child_id: int | None = None
    right_child_id: int | None = None
    # Level 4 — business logic
    service_method: str | None = None
    database_query: str | None = None
    external_api_call: str | None = None
    condition: str | None = None
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    # Level 6 — flow control
    node_role: str | None = None
    branch_condition: str | None = None
    # Level 6 — response layer
    http_status_code: int | None = None
    error_type: str | None = None
    # Level 6 — execution config
    retry_count: int = 0
    timeout_ms: int | None = None
    is_async: bool = False
    sla_ms: int | None = None
    # Level 6 — documentation
    description: str | None = None
    owner_team: str | None = None
    created_at: datetime


class ExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: str
    node_id: int
    status: str
    duration_ms: int | None = None
    input_data: dict[str, Any] | None = None
    output_data: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime


class RunRequest(BaseModel):
    root_node_id: int


class RunResponse(BaseModel):
    run_id: str
    executions: list[ExecutionResponse]
