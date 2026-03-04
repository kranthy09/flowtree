import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.node import NodeCreate, NodeResponse, NodeUpdate
from app.services import node_service

router = APIRouter(tags=["nodes"])

_PREFIX = "/workspaces/{workspace_id}/nodes"


@router.get(_PREFIX, response_model=list[NodeResponse])
async def list_nodes(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[NodeResponse]:
    return await node_service.list_nodes(db, workspace_id)


@router.post(
    _PREFIX,
    response_model=NodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_node(
    workspace_id: uuid.UUID,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    return await node_service.create_node(db, workspace_id, data)


# /tree must be declared before /{node_id} so it is not shadowed
@router.get(f"{_PREFIX}/tree", response_model=NodeResponse)
async def get_tree(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    return await node_service.get_tree(db, workspace_id)


@router.put(f"{_PREFIX}/{{node_id}}", response_model=NodeResponse)
async def update_node(
    workspace_id: uuid.UUID,
    node_id: uuid.UUID,
    data: NodeUpdate,
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    return await node_service.update_node(db, workspace_id, node_id, data)


@router.delete(
    f"{_PREFIX}/{{node_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_node(
    workspace_id: uuid.UUID,
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await node_service.delete_node(db, workspace_id, node_id)
