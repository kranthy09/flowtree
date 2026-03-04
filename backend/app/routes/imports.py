import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.node import FlowNode
from app.repositories import workspace_repo
from app.services import import_service

router = APIRouter(tags=["imports"])


class ImportOpenApiRequest(BaseModel):
    content: str   # raw JSON or YAML string
    merge:   bool = True


class ImportOpenApiResponse(BaseModel):
    count:   int
    message: str


@router.post(
    "/workspaces/{workspace_id}/import/openapi",
    response_model=ImportOpenApiResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_openapi(
    workspace_id: uuid.UUID,
    body: ImportOpenApiRequest,
    db: AsyncSession = Depends(get_db),
) -> ImportOpenApiResponse:
    ws = await workspace_repo.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id} not found",
        )

    if not body.merge:
        # Delete all existing nodes in one statement; FK CASCADE removes children.
        await db.execute(
            sql_delete(FlowNode).where(FlowNode.workspace_id == workspace_id)
        )
        await db.commit()

    try:
        nodes = import_service.from_openapi(body.content, workspace_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse OpenAPI spec: {exc}",
        ) from exc

    for node in nodes:
        db.add(node)
    await db.commit()

    return ImportOpenApiResponse(
        count=len(nodes),
        message=f"Imported {len(nodes)} nodes successfully.",
    )
