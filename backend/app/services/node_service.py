import uuid

from fastapi import HTTPException, status
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.node import FlowNode
from app.repositories import node_repo, workspace_repo
from app.schemas.node import NodeCreate, NodeResponse, NodeType, NodeUpdate

# Mirrors VALID_CONNECTIONS from frontend/src/lib/nodeTypes.ts
VALID_CONNECTIONS: dict[NodeType, list[NodeType]] = {
    NodeType.API: [NodeType.ENDPOINT, NodeType.MODEL],
    NodeType.ENDPOINT: [NodeType.REQUEST, NodeType.RESPONSE, NodeType.STEP],
    NodeType.REQUEST: [NodeType.FIELD],
    NodeType.RESPONSE: [NodeType.FIELD],
    NodeType.MODEL: [NodeType.FIELD],
    NodeType.FIELD: [NodeType.FIELD],   # nested objects
    NodeType.STEP: [NodeType.STEP],     # sequential pipeline
}


async def list_nodes(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[NodeResponse]:
    nodes = await node_repo.list_nodes(db, workspace_id)
    return [_to_response(n) for n in nodes]


async def get_node(
    db: AsyncSession, workspace_id: uuid.UUID, node_id: uuid.UUID
) -> NodeResponse:
    node = await _require_node(db, workspace_id, node_id)
    return _to_response(node)


async def create_node(
    db: AsyncSession, workspace_id: uuid.UUID, data: NodeCreate
) -> NodeResponse:
    # Verify workspace exists
    ws = await workspace_repo.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace {workspace_id} not found",
        )

    if data.parent_id is not None:
        parent = await node_repo.get_node(db, data.parent_id)
        if parent is None or parent.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent node {data.parent_id} not found",
            )
        _validate_connection(NodeType(parent.node_type), data.node_type)
    elif data.node_type != NodeType.API:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Only 'api' nodes can be root nodes (no parent_id). "
                f"Got node_type='{data.node_type.value}'."
            ),
        )

    node = await node_repo.create_node(db, workspace_id, data)
    return _to_response(node)


async def update_node(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    node_id: uuid.UUID,
    data: NodeUpdate,
) -> NodeResponse:
    node = await _require_node(db, workspace_id, node_id)
    node = await node_repo.update_node(db, node, data)
    return _to_response(node)


async def delete_node(
    db: AsyncSession, workspace_id: uuid.UUID, node_id: uuid.UUID
) -> None:
    node = await _require_node(db, workspace_id, node_id)
    await node_repo.delete_node(db, node)


async def get_tree(
    db: AsyncSession, workspace_id: uuid.UUID
) -> NodeResponse:
    """Return the API root node with all descendants nested recursively."""
    all_nodes = await node_repo.list_nodes(db, workspace_id)
    if not all_nodes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No nodes found in workspace",
        )

    # Build a map of parent_id → ordered list of children
    children_map: dict[uuid.UUID, list[FlowNode]] = {}
    root: FlowNode | None = None
    for node in all_nodes:
        if node.parent_id is None and node.node_type == NodeType.API.value:
            root = root or node  # first API root wins
        if node.parent_id is not None:
            children_map.setdefault(node.parent_id, []).append(node)

    # Fall back to first node without a parent if no API root type
    if root is None:
        root = next((n for n in all_nodes if n.parent_id is None), None)

    if root is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No root node found in workspace",
        )

    return _build_response(root, children_map)


# ── helpers ────────────────────────────────────────────────────────────────


def _orm_to_dict(node: FlowNode) -> dict:
    """Extract only DB column values from a FlowNode ORM object.

    Using model_validate(orm_obj) with from_attributes=True would trigger
    SQLAlchemy's lazy-loading of the ``children`` relationship inside an
    async greenlet — causing a MissingGreenlet error.  Reading columns
    directly avoids touching any relationship.
    """
    mapper = sa_inspect(FlowNode)
    data: dict = {col.key: getattr(node, col.key) for col in mapper.columns}
    # The ORM column is named nullable_field; the API field is nullable
    data["nullable"] = data.pop("nullable_field")
    data["children"] = []
    return data


def _to_response(node: FlowNode) -> NodeResponse:
    return NodeResponse.model_validate(_orm_to_dict(node))


def _validate_connection(parent_type: NodeType, child_type: NodeType) -> None:
    allowed = VALID_CONNECTIONS.get(parent_type, [])
    if child_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Cannot attach '{child_type.value}' node to "
                f"'{parent_type.value}' node. "
                f"Allowed children: {[t.value for t in allowed]}"
            ),
        )


async def _require_node(
    db: AsyncSession, workspace_id: uuid.UUID, node_id: uuid.UUID
) -> FlowNode:
    node = await node_repo.get_node(db, node_id)
    if node is None or node.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )
    return node


def _build_response(
    node: FlowNode,
    children_map: dict[uuid.UUID, list[FlowNode]],
) -> NodeResponse:
    """Recursively build a NodeResponse with nested children."""
    child_responses = [
        _build_response(child, children_map)
        for child in children_map.get(node.id, [])
    ]
    data = _orm_to_dict(node)
    data["children"] = [c.model_dump() for c in child_responses]
    return NodeResponse.model_validate(data)
