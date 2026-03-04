import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.execution import RunDetail, RunRequest, RunResponse, RunSummary
from app.services import execution_service

router = APIRouter(tags=["executions"])

_PREFIX = "/workspaces/{workspace_id}"


@router.post(
    f"{_PREFIX}/run",
    response_model=RunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_pipeline(
    workspace_id: uuid.UUID,
    data: RunRequest,
) -> RunResponse:
    if data.node_id is not None:
        return await execution_service.dispatch_single_node(
            workspace_id, data.node_id, data.initial_context
        )
    return await execution_service.dispatch_pipeline(workspace_id, data.initial_context)


@router.get(f"{_PREFIX}/executions", response_model=list[RunSummary])
async def list_executions(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[RunSummary]:
    return await execution_service.list_runs(db, workspace_id)


@router.get(f"{_PREFIX}/executions/{{run_id}}", response_model=RunDetail)
async def get_execution(
    workspace_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RunDetail:
    return await execution_service.get_run(db, workspace_id, run_id)
