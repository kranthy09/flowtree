from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_session, get_workspace_id
from app.schemas import NodeCreate, NodeResponse, NodeUpdate
from app.services import node_service

router = APIRouter()


@router.get("", response_model=list[NodeResponse])
async def list_nodes(
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> list[NodeResponse]:
    return await node_service.get_all_nodes(session, workspace_id)


@router.post("", response_model=NodeResponse, status_code=201)
async def create_node(
    data: NodeCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> NodeResponse:
    return await node_service.create_node(session, workspace_id, data)


@router.patch("/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: int,
    data: NodeUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> NodeResponse:
    node = await node_service.update_node(session, workspace_id, node_id, data)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.delete("/{node_id}")
async def delete_node(
    node_id: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> dict[str, bool]:
    deleted = await node_service.delete_node(session, workspace_id, node_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"ok": True}
