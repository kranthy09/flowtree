import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.node import FlowNode
from app.schemas.node import NodeCreate, NodeUpdate


async def list_nodes(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[FlowNode]:
    """Return all nodes for a workspace, flat, ordered by creation time."""
    stmt = (
        select(FlowNode)
        .where(FlowNode.workspace_id == workspace_id)
        .order_by(FlowNode.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_node(
    db: AsyncSession, node_id: uuid.UUID
) -> FlowNode | None:
    """Return one node by primary key."""
    stmt = select(FlowNode).where(FlowNode.id == node_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_node(
    db: AsyncSession, workspace_id: uuid.UUID, data: NodeCreate
) -> FlowNode:
    """Insert a new node and return the persisted row."""
    fields = data.model_dump()
    # ORM column is nullable_field; schema field is nullable
    fields["nullable_field"] = fields.pop("nullable")
    node = FlowNode(workspace_id=workspace_id, **fields)
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def update_node(
    db: AsyncSession, node: FlowNode, data: NodeUpdate
) -> FlowNode:
    """Apply only the fields explicitly set in *data* to *node*."""
    for key, value in data.model_dump(exclude_unset=True).items():
        orm_key = "nullable_field" if key == "nullable" else key
        setattr(node, orm_key, value)
    await db.commit()
    await db.refresh(node)
    return node


async def delete_node(db: AsyncSession, node: FlowNode) -> None:
    """Delete *node*; children are removed via FK ON DELETE CASCADE."""
    await db.delete(node)
    await db.commit()
