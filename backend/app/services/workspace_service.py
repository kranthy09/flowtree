import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import workspace_repo
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceDetailResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)


async def list_workspaces(db: AsyncSession) -> list[WorkspaceResponse]:
    rows = await workspace_repo.list_workspaces(db)
    return [
        WorkspaceResponse.model_validate(ws).model_copy(update={"node_count": count})
        for ws, count in rows
    ]


async def get_workspace(
    db: AsyncSession, workspace_id: uuid.UUID
) -> WorkspaceDetailResponse:
    ws = await workspace_repo.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id} not found",
        )
    response = WorkspaceDetailResponse.model_validate(ws)
    response = response.model_copy(
        update={"node_count": len(ws.nodes), "nodes": ws.nodes}
    )
    return response


async def create_workspace(
    db: AsyncSession, data: WorkspaceCreate
) -> WorkspaceDetailResponse:
    ws = await workspace_repo.create_workspace(db, data)
    return WorkspaceDetailResponse.model_validate(ws).model_copy(
        update={"node_count": 0, "nodes": []}
    )


async def update_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, data: WorkspaceUpdate
) -> WorkspaceDetailResponse:
    ws = await workspace_repo.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id} not found",
        )
    ws = await workspace_repo.update_workspace(db, ws, data)
    response = WorkspaceDetailResponse.model_validate(ws)
    return response.model_copy(
        update={"node_count": len(ws.nodes), "nodes": ws.nodes}
    )


async def delete_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> None:
    ws = await workspace_repo.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id} not found",
        )
    await workspace_repo.delete_workspace(db, ws)
