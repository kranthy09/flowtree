import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class NodeType(str, Enum):
    API = "api"
    ENDPOINT = "endpoint"
    REQUEST = "request"
    RESPONSE = "response"
    FIELD = "field"
    MODEL = "model"
    STEP = "step"


class NodeCreate(BaseModel):
    """Fields supplied by the client when creating a node.

    workspace_id is injected from the URL path parameter, not the body.
    """

    node_type: NodeType
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] = []
    parent_id: uuid.UUID | None = None
    position_x: float = 0.0
    position_y: float = 0.0

    # API
    title: str | None = None
    version: str | None = None
    base_url: str | None = None
    tech_stack: str | None = None
    architecture_notes: str | None = None
    auth_scheme: str | None = None

    # ENDPOINT
    method: str | None = None
    path: str | None = None
    summary: str | None = None
    operation_id: str | None = None
    deprecated: bool = False
    query_params: list[dict] = []
    service_method: str | None = None
    database_query: str | None = None
    conditions: list[str] = []
    is_async: bool = True

    # REQUEST / RESPONSE
    content_type: str = "application/json"
    model_ref: str | None = None
    example: dict | None = None
    validation_rules: list[str] = []
    status_code: int | None = None
    is_error: bool = False
    error_type: str | None = None

    # FIELD
    field_type: str | None = None
    field_format: str | None = None
    required: bool = True
    nullable: bool = False
    read_only: bool = False
    write_only: bool = False
    default_value: dict | None = None
    items_type: str | None = None
    items_ref: str | None = None
    object_ref: str | None = None
    constraints: dict = {}
    field_example: dict | None = None

    # MODEL
    base_class: str | None = None
    orm_table: str | None = None
    indexes: list[str] = []

    # STEP
    language: str = "python"
    code: str | None = None
    input_keys: list[str] = []
    output_key: str | None = None


class NodeUpdate(BaseModel):
    """All fields optional — only set fields are written to the DB."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] | None = None
    parent_id: uuid.UUID | None = None
    position_x: float | None = None
    position_y: float | None = None

    # API
    title: str | None = None
    version: str | None = None
    base_url: str | None = None
    tech_stack: str | None = None
    architecture_notes: str | None = None
    auth_scheme: str | None = None

    # ENDPOINT
    method: str | None = None
    path: str | None = None
    summary: str | None = None
    operation_id: str | None = None
    deprecated: bool | None = None
    query_params: list[dict] | None = None
    service_method: str | None = None
    database_query: str | None = None
    conditions: list[str] | None = None
    is_async: bool | None = None

    # REQUEST / RESPONSE
    content_type: str | None = None
    model_ref: str | None = None
    example: dict | None = None
    validation_rules: list[str] | None = None
    status_code: int | None = None
    is_error: bool | None = None
    error_type: str | None = None

    # FIELD
    field_type: str | None = None
    field_format: str | None = None
    required: bool | None = None
    nullable: bool | None = None
    read_only: bool | None = None
    write_only: bool | None = None
    default_value: dict | None = None
    items_type: str | None = None
    items_ref: str | None = None
    object_ref: str | None = None
    constraints: dict | None = None
    field_example: dict | None = None

    # MODEL
    base_class: str | None = None
    orm_table: str | None = None
    indexes: list[str] | None = None

    # STEP
    language: str | None = None
    code: str | None = None
    input_keys: list[str] | None = None
    output_key: str | None = None


class NodeResponse(BaseModel):
    """Returned by all node endpoints.

    For flat-list endpoints, ``children`` is always [].
    For the /tree endpoint, ``children`` is populated recursively.

    The ORM column is ``nullable_field`` (renamed to avoid SQLAlchemy's
    reserved ``nullable`` attribute); the API field is ``nullable``.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    node_type: str
    name: str
    description: str | None
    tags: list
    parent_id: uuid.UUID | None
    position_x: float
    position_y: float

    # API
    title: str | None
    version: str | None
    base_url: str | None
    tech_stack: str | None
    architecture_notes: str | None
    auth_scheme: str | None

    # ENDPOINT
    method: str | None
    path: str | None
    summary: str | None
    operation_id: str | None
    deprecated: bool
    query_params: list
    service_method: str | None
    database_query: str | None
    conditions: list
    is_async: bool

    # REQUEST / RESPONSE
    content_type: str
    model_ref: str | None
    example: dict | None
    validation_rules: list
    status_code: int | None
    is_error: bool
    error_type: str | None

    # FIELD — ORM attr is nullable_field; alias maps it to 'nullable' in API
    field_type: str | None
    field_format: str | None
    required: bool
    nullable: bool = Field(False, validation_alias="nullable_field")
    read_only: bool
    write_only: bool
    default_value: dict | None
    items_type: str | None
    items_ref: str | None
    object_ref: str | None
    constraints: dict
    field_example: dict | None

    # MODEL
    base_class: str | None
    orm_table: str | None
    indexes: list

    # STEP
    language: str
    code: str | None
    input_keys: list
    output_key: str | None

    # timestamps
    created_at: datetime
    updated_at: datetime

    # tree — empty for flat-list responses, populated for /tree
    children: list["NodeResponse"] = []


NodeResponse.model_rebuild()
