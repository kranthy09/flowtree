import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceDetailResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(db: AsyncSession = Depends(get_db)) -> list[WorkspaceResponse]:
    return await workspace_service.list_workspaces(db)


@router.post("", response_model=WorkspaceDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceDetailResponse:
    return await workspace_service.create_workspace(db, data)


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceDetailResponse:
    return await workspace_service.get_workspace(db, workspace_id)


@router.put("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceDetailResponse:
    return await workspace_service.update_workspace(db, workspace_id, data)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await workspace_service.delete_workspace(db, workspace_id)
