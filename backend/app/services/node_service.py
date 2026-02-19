from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NumberNode
from app.schemas import NodeCreate, NodeUpdate


async def get_all_nodes(
    session: AsyncSession, workspace_id: str
) -> list[NumberNode]:
    result = await session.execute(
        select(NumberNode).where(NumberNode.workspace_id == workspace_id)
    )
    return list(result.scalars().all())


async def create_node(
    session: AsyncSession, workspace_id: str, data: NodeCreate
) -> NumberNode:
    node = NumberNode(workspace_id=workspace_id, **data.model_dump())
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node


async def update_node(
    session: AsyncSession, workspace_id: str, node_id: int, data: NodeUpdate
) -> NumberNode | None:
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.id == node_id,
            NumberNode.workspace_id == workspace_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        return None
    if data.value is not None:
        node.value = data.value
    if data.name is not None:
        node.name = data.name
    if data.type is not None:
        node.type = data.type
    await session.commit()
    await session.refresh(node)
    return node


async def delete_node(
    session: AsyncSession, workspace_id: str, node_id: int
) -> bool:
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.id == node_id,
            NumberNode.workspace_id == workspace_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        return False
    await session.delete(node)
    await session.commit()
    return True
