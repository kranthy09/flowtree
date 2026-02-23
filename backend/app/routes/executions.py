from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_session, get_workspace_id
from app.schemas import ExecutionResponse, RunRequest, RunResponse
from app.services import execution_service

router = APIRouter()


@router.post("", response_model=RunResponse, status_code=201)
async def run_tree(
    data: RunRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> RunResponse:
    try:
        executions = await execution_service.execute_tree(
            session, workspace_id, data.root_node_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    run_id = executions[0].run_id if executions else ""
    return RunResponse(run_id=run_id, executions=executions)


@router.get("", response_model=list[ExecutionResponse])
async def list_executions(
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> list[ExecutionResponse]:
    return await execution_service.get_runs(session, workspace_id)


@router.get("/{run_id}", response_model=list[ExecutionResponse])
async def get_run(
    run_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: Annotated[str, Depends(get_workspace_id)],
) -> list[ExecutionResponse]:
    results = await execution_service.get_run(session, workspace_id, run_id)
    if not results:
        raise HTTPException(status_code=404, detail="Run not found")
    return results
