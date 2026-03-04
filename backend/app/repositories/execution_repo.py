import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.execution import Execution
from app.models.node import FlowNode


async def list_runs(db: AsyncSession, workspace_id: uuid.UUID) -> list:
    """Return one row per distinct run_id with aggregated status flags, latest first."""
    stmt = (
        select(
            Execution.run_id,
            Execution.workspace_id,
            func.min(Execution.created_at).label("created_at"),
            func.bool_or(Execution.status == "ERROR").label("has_error"),
            func.bool_or(Execution.status.in_(["RUNNING", "PENDING"])).label("has_running"),
        )
        .where(Execution.workspace_id == workspace_id)
        .group_by(Execution.run_id, Execution.workspace_id)
        .order_by(func.min(Execution.created_at).desc())
    )
    result = await db.execute(stmt)
    return result.mappings().all()


async def get_run_executions(
    db: AsyncSession, workspace_id: uuid.UUID, run_id: uuid.UUID
) -> list:
    """Return (Execution, node_name) rows for one run ordered by creation time."""
    stmt = (
        select(Execution, FlowNode.name.label("node_name"))
        .join(FlowNode, Execution.node_id == FlowNode.id)
        .where(
            Execution.workspace_id == workspace_id,
            Execution.run_id == run_id,
        )
        .order_by(Execution.created_at)
    )
    result = await db.execute(stmt)
    return result.all()
