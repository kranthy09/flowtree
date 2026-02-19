from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

_VALID_TYPES = ("input", "process", "output")


class NodeCreate(BaseModel):
    value: int
    name: str | None = None
    type: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError("type must be 'input', 'process', or 'output'")
        return v


class NodeUpdate(BaseModel):
    value: int | None = None
    name: str | None = None
    type: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError("type must be 'input', 'process', or 'output'")
        return v


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: int
    name: str | None = None
    type: str | None = None
    created_at: datetime
