from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NumberNode
from app.schemas import NodeCreate, NodeUpdate

# Fields that need relational validation (handled explicitly in update_node)
_RELATIONSHIP_FIELDS = {"parent_id", "left_child_id", "right_child_id"}


async def _validate_parent(
    session: AsyncSession,
    workspace_id: str,
    parent_id: int | None,
    node_id: int | None = None,
) -> None:
    """Validate parent_id is in same workspace, not self."""
    if parent_id is None:
        return
    if node_id is not None and parent_id == node_id:
        raise ValueError("Node cannot be its own parent")
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.id == parent_id,
            NumberNode.workspace_id == workspace_id,
        )
    )
    if not result.scalar_one_or_none():
        raise ValueError(
            f"Parent node {parent_id} not found in this workspace"
        )


async def _validate_child_ref(
    session: AsyncSession,
    workspace_id: str,
    child_id: int | None,
    node_id: int | None,
    field_name: str,
) -> None:
    """Validate a left_child_id or right_child_id reference."""
    if child_id is None:
        return

    # 1. Self-reference check
    if node_id is not None and child_id == node_id:
        raise ValueError(f"{field_name}: node cannot reference itself")

    # 2. Workspace ownership check
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.id == child_id,
            NumberNode.workspace_id == workspace_id,
        )
    )
    if not result.scalar_one_or_none():
        raise ValueError(
            f"{field_name}: node {child_id} not found in this workspace"
        )

    # 3. Circular reference check — walk DOWN the left/right child tree
    #    from child_id. If we reach node_id it would create a cycle.
    if node_id is not None:
        visited: set[int] = set()
        to_visit = [child_id]
        while to_visit:
            current = to_visit.pop()
            if current == node_id:
                raise ValueError(
                    f"{field_name}: circular reference detected"
                )
            if current in visited:
                continue
            visited.add(current)
            row_result = await session.execute(
                select(
                    NumberNode.left_child_id,
                    NumberNode.right_child_id,
                ).where(
                    NumberNode.id == current,
                    NumberNode.workspace_id == workspace_id,
                )
            )
            row = row_result.first()
            if row:
                if row[0] is not None:
                    to_visit.append(row[0])
                if row[1] is not None:
                    to_visit.append(row[1])

    # 4. Dual-parent check — child must not be left/right of another node
    conditions = [
        NumberNode.workspace_id == workspace_id,
        (
            (NumberNode.left_child_id == child_id)
            | (NumberNode.right_child_id == child_id)
        ),
    ]
    if node_id is not None:
        conditions.append(NumberNode.id != node_id)
    result = await session.execute(
        select(NumberNode).where(*conditions)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError(
            f"{field_name}: node {child_id} is already a child"
            f" of node {existing.id}"
        )


async def _validate_logic_fields(data) -> None:
    """Validate business logic fields."""
    if data.input_schema is not None and not isinstance(
        data.input_schema, dict
    ):
        raise ValueError("input_schema must be a JSON object")
    if data.output_schema is not None and not isinstance(
        data.output_schema, dict
    ):
        raise ValueError("output_schema must be a JSON object")


async def get_all_nodes(
    session: AsyncSession, workspace_id: str
) -> list[NumberNode]:
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.workspace_id == workspace_id
        )
    )
    return list(result.scalars().all())


async def create_node(
    session: AsyncSession, workspace_id: str, data: NodeCreate
) -> NumberNode:
    if (
        data.left_child_id
        and data.right_child_id
        and data.left_child_id == data.right_child_id
    ):
        raise ValueError(
            "left_child_id and right_child_id cannot be the same node"
        )
    await _validate_parent(session, workspace_id, data.parent_id)
    await _validate_child_ref(
        session, workspace_id, data.left_child_id, None, "left_child_id"
    )
    await _validate_child_ref(
        session, workspace_id, data.right_child_id, None, "right_child_id"
    )
    await _validate_logic_fields(data)
    node = NumberNode(workspace_id=workspace_id, **data.model_dump())
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node


async def update_node(
    session: AsyncSession,
    workspace_id: str,
    node_id: int,
    data: NodeUpdate,
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

    # Only operate on fields actually sent in the request
    update_data = data.model_dump(exclude_unset=True)

    # Left == right check using effective values after update
    final_left = update_data.get("left_child_id", node.left_child_id)
    final_right = update_data.get("right_child_id", node.right_child_id)
    if (
        final_left is not None
        and final_right is not None
        and final_left == final_right
    ):
        raise ValueError(
            "left_child_id and right_child_id cannot be the same node"
        )

    await _validate_logic_fields(data)

    # Relationship fields — validate before applying
    if "parent_id" in update_data:
        await _validate_parent(
            session, workspace_id, update_data["parent_id"], node_id
        )
    if "left_child_id" in update_data:
        await _validate_child_ref(
            session,
            workspace_id,
            update_data["left_child_id"],
            node_id,
            "left_child_id",
        )
    if "right_child_id" in update_data:
        await _validate_child_ref(
            session,
            workspace_id,
            update_data["right_child_id"],
            node_id,
            "right_child_id",
        )

    # value must not be set to null (non-nullable DB column)
    if "value" in update_data and update_data["value"] is None:
        del update_data["value"]

    # Apply all fields
    for field, value in update_data.items():
        setattr(node, field, value)

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
