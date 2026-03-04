import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import execution_repo
from app.schemas.execution import ExecutionDetail, RunDetail, RunResponse, RunSummary
from app.workers.tasks import execute_pipeline, execute_single_node


# ── status helpers ─────────────────────────────────────────────────────────


def _overall_status(has_error: bool, has_running: bool) -> str:
    if has_error:
        return "error"
    if has_running:
        return "running"
    return "completed"


# ── dispatch ───────────────────────────────────────────────────────────────


async def dispatch_pipeline(
    workspace_id: uuid.UUID, initial_context: dict
) -> RunResponse:
    """Enqueue execute_pipeline for all STEP nodes in the workspace."""
    run_id = uuid.uuid4()
    result = execute_pipeline.apply_async(
        args=[str(workspace_id), str(run_id), initial_context]
    )
    return RunResponse(run_id=run_id, status="queued", task_id=result.id)


async def dispatch_single_node(
    workspace_id: uuid.UUID, node_id: uuid.UUID, input_data: dict
) -> RunResponse:
    """Enqueue execute_single_node for one STEP node."""
    run_id = uuid.uuid4()
    result = execute_single_node.apply_async(
        args=[str(node_id), str(run_id), input_data]
    )
    return RunResponse(run_id=run_id, status="queued", task_id=result.id)


# ── query ──────────────────────────────────────────────────────────────────


async def list_runs(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[RunSummary]:
    """Return one RunSummary per distinct run_id, latest first."""
    rows = await execution_repo.list_runs(db, workspace_id)
    return [
        RunSummary(
            run_id=row["run_id"],
            workspace_id=row["workspace_id"],
            status=_overall_status(row["has_error"], row["has_running"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


async def get_run(
    db: AsyncSession, workspace_id: uuid.UUID, run_id: uuid.UUID
) -> RunDetail:
    """Return full detail for one run, or raise 404 if not found."""
    rows = await execution_repo.get_run_executions(db, workspace_id, run_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found in workspace {workspace_id}",
        )

    first_exec, _ = rows[0]
    has_error   = any(exec_row.status == "ERROR"                     for exec_row, _ in rows)
    has_running = any(exec_row.status in ("RUNNING", "PENDING")      for exec_row, _ in rows)

    return RunDetail(
        run_id=run_id,
        workspace_id=workspace_id,
        status=_overall_status(has_error, has_running),
        created_at=first_exec.created_at,
        executions=[
            ExecutionDetail(
                node_id=exec_row.node_id,
                node_name=node_name,
                status=exec_row.status,
                input_data=exec_row.input_data,
                output_data=exec_row.output_data,
                error_message=exec_row.error_message,
                duration_ms=exec_row.duration_ms,
            )
            for exec_row, node_name in rows
        ],
    )
