import time
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Execution, NumberNode


async def execute_tree(
    session: AsyncSession, workspace_id: str, root_node_id: int
) -> list[Execution]:
    """
    Railway-Oriented conditional traversal from root node.

    Each child's branch_condition determines whether it executes:
      - 'success'  : only if parent succeeded
      - 'failure'  : only if parent failed
      - 'always'   : regardless of parent result (default when None)

    Retry: each node is attempted 1 + node.retry_count times.
    """
    run_id = str(uuid4())

    root = await _get_node(session, workspace_id, root_node_id)
    if not root:
        raise ValueError(
            f"Node {root_node_id} not found in this workspace"
        )

    executions: list[Execution] = []
    await _execute_recursive(
        session, workspace_id, run_id, root, None, executions, set()
    )

    await session.commit()

    for ex in executions:
        await session.refresh(ex)

    return executions


def _should_traverse(condition: str | None, parent_status: str) -> bool:
    """
    Return True if a child node should be executed given its
    branch_condition and the parent's execution status.
    None branch_condition defaults to 'always' for backward compat.
    """
    effective = condition or "always"
    if effective == "always":
        return True
    if effective == "success":
        return parent_status == "SUCCESS"
    if effective == "failure":
        return parent_status == "FAILED"
    return True  # unknown values default to 'always'


async def _execute_recursive(
    session: AsyncSession,
    workspace_id: str,
    run_id: str,
    node: NumberNode,
    parent_output: dict | None,
    executions: list[Execution],
    visited: set[int],
) -> None:
    """
    Execute one node (with retry), then conditionally recurse into
    left and right children based on their branch_condition.
    """
    if node.id in visited:
        return  # cycle guard
    visited.add(node.id)

    execution = await _execute_node_with_retry(
        session, workspace_id, run_id, node, parent_output
    )
    executions.append(execution)

    current_status = execution.status
    child_input = (
        execution.output_data if current_status == "SUCCESS" else None
    )

    # ── Left child ────────────────────────────────────────────────────────
    if node.left_child_id:
        left = await _get_node(session, workspace_id, node.left_child_id)
        if left and _should_traverse(left.branch_condition, current_status):
            await _execute_recursive(
                session, workspace_id, run_id,
                left, child_input, executions, visited,
            )

    # ── Right child ───────────────────────────────────────────────────────
    if node.right_child_id:
        right = await _get_node(
            session, workspace_id, node.right_child_id
        )
        if right and _should_traverse(
            right.branch_condition, current_status
        ):
            await _execute_recursive(
                session, workspace_id, run_id,
                right, child_input, executions, visited,
            )


async def _execute_node_with_retry(
    session: AsyncSession,
    workspace_id: str,
    run_id: str,
    node: NumberNode,
    parent_output: dict | None,
) -> Execution:
    """
    Execute a node, retrying on failure up to node.retry_count times.
    Total attempts = 1 + (node.retry_count or 0).
    The Execution record is created once with the final outcome.
    """
    max_attempts = 1 + (node.retry_count or 0)
    last_exc: Exception | None = None
    output: dict | None = None
    status = "FAILED"
    total_elapsed = 0

    for attempt in range(max_attempts):
        start = time.perf_counter()
        try:
            output = _simulate_node(node, parent_output)
            total_elapsed += int((time.perf_counter() - start) * 1000)
            status = "SUCCESS"
            last_exc = None
            break
        except Exception as exc:
            total_elapsed += int((time.perf_counter() - start) * 1000)
            last_exc = exc

    execution = Execution(
        workspace_id=workspace_id,
        run_id=run_id,
        node_id=node.id,
        status=status,
        duration_ms=total_elapsed,
        input_data=parent_output,
        output_data=output if status == "SUCCESS" else None,
        error_message=str(last_exc) if last_exc else None,
    )
    session.add(execution)
    return execution


def _simulate_node(
    node: NumberNode, input_data: dict | None
) -> dict:
    """
    Simulate node execution based on its business logic fields.
    Level 6: reflects node_role, http_status_code, is_async in result.
    Raises RuntimeError for error-role nodes or force_fail input.
    """
    result: dict = {"node_id": node.id, "value": node.value}

    if node.node_role:
        result["node_role"] = node.node_role

    # error-role nodes always fail (they represent error terminals)
    if node.node_role == "error":
        raise RuntimeError(
            node.error_type or "GENERIC_ERROR"
        )

    if node.http_status_code:
        result["http_status_code"] = node.http_status_code

    if node.is_async:
        result["executed_async"] = True

    if node.condition:
        result["condition"] = node.condition
        result["condition_met"] = True
        if input_data and "force_fail" in input_data:
            raise RuntimeError(f"Condition failed: {node.condition}")

    if node.service_method:
        result["service_called"] = node.service_method

    if node.database_query:
        result["query_executed"] = node.database_query

    if node.external_api_call:
        result["api_called"] = node.external_api_call

    if node.output_schema:
        result["schema_output"] = {
            k: f"mock_{k}" for k in node.output_schema
        }

    return result


async def _get_node(
    session: AsyncSession, workspace_id: str, node_id: int
) -> NumberNode | None:
    result = await session.execute(
        select(NumberNode).where(
            NumberNode.id == node_id,
            NumberNode.workspace_id == workspace_id,
        )
    )
    return result.scalar_one_or_none()


# ── Read-only helpers (unchanged API) ─────────────────────────────────────────

async def get_runs(
    session: AsyncSession, workspace_id: str
) -> list[Execution]:
    """Get all executions for a workspace, newest first."""
    result = await session.execute(
        select(Execution)
        .where(Execution.workspace_id == workspace_id)
        .order_by(Execution.created_at.desc())
    )
    return list(result.scalars().all())


async def get_run(
    session: AsyncSession, workspace_id: str, run_id: str
) -> list[Execution]:
    """Get all executions for a specific run_id, in creation order."""
    result = await session.execute(
        select(Execution)
        .where(
            Execution.workspace_id == workspace_id,
            Execution.run_id == run_id,
        )
        .order_by(Execution.created_at.asc())
    )
    return list(result.scalars().all())
