import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.node import FlowNode
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


async def list_workspaces(db: AsyncSession) -> list[tuple[Workspace, int]]:
    """Return all workspaces with their node counts, newest first."""
    node_count_sq = (
        select(func.count(FlowNode.id))
        .where(FlowNode.workspace_id == Workspace.id)
        .correlate(Workspace)
        .scalar_subquery()
    )
    stmt = (
        select(Workspace, node_count_sq.label("node_count"))
        .order_by(Workspace.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.all())


async def get_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> Workspace | None:
    """Return one workspace with its nodes pre-loaded (selectin)."""
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_workspace(db: AsyncSession, data: WorkspaceCreate) -> Workspace:
    workspace = Workspace(name=data.name, description=data.description)
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def update_workspace(
    db: AsyncSession, workspace: Workspace, data: WorkspaceUpdate
) -> Workspace:
    if data.name is not None:
        workspace.name = data.name
    if data.description is not None:
        workspace.description = data.description
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(db: AsyncSession, workspace: Workspace) -> None:
    await db.delete(workspace)
    await db.commit()
