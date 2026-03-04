import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories import node_repo
from app.schemas.export import ExportRequest, ExportResponse
from app.services import export_service

router = APIRouter(tags=["exports"])

_PREFIX = "/workspaces/{workspace_id}/export"


@router.post(f"{_PREFIX}/openapi", response_model=ExportResponse)
async def export_openapi(
    workspace_id: uuid.UUID,
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
) -> ExportResponse:
    nodes = await node_repo.list_nodes(db, workspace_id)
    content = export_service.to_openapi(nodes, data.output_format)
    ext = "yaml" if data.output_format == "yaml" else "json"
    return ExportResponse(content=content, format=data.output_format, filename=f"openapi.{ext}")


@router.post(f"{_PREFIX}/schema", response_model=ExportResponse)
async def export_schema(
    workspace_id: uuid.UUID,
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
) -> ExportResponse:
    nodes = await node_repo.list_nodes(db, workspace_id)
    content = export_service.to_json_schema(nodes, data.model_name)
    return ExportResponse(content=content, format="json", filename="schema.json")


@router.post(f"{_PREFIX}/prompt", response_model=ExportResponse)
async def export_prompt(
    workspace_id: uuid.UUID,
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
) -> ExportResponse:
    nodes = await node_repo.list_nodes(db, workspace_id)
    content = export_service.to_agent_prompt(nodes)
    return ExportResponse(content=content, format="markdown", filename="prompt.md")
