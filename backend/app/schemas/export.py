from enum import Enum

from pydantic import BaseModel


class ExportFormat(str, Enum):
    OPENAPI = "openapi"
    SCHEMA = "schema"
    PROMPT = "prompt"


class ExportRequest(BaseModel):
    model_name: str | None = None
    output_format: str = "json"  # "json" | "yaml"


class ExportResponse(BaseModel):
    content: str
    format: str
    filename: str
