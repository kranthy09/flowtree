"""
Celery tasks for FlowTree pipeline execution.

Workers use a synchronous psycopg2 engine — NOT the asyncpg engine used by
FastAPI routes.  All DB interaction here uses SQLAlchemy Core text() queries
so that this module has no dependency on the async ORM models in app.models.

Execution mirrors the logic in main.py Node.execute():
  - Only STEP nodes with non-empty code are executed.
  - All other node types produce a SKIPPED record.
  - Context (a plain dict) flows between nodes via input_keys / output_key.
  - DFS pre-order matches Tree._run_node() in main.py.

Idempotency guarantee (checklist rule 29):
  If execute_pipeline is called a second time with the same run_id, it checks
  for existing execution rows and returns early without re-running any steps.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


# ── Sync DB engine ─────────────────────────────────────────────────────────────

def _make_sync_url() -> str:
    """Derive a psycopg2-compatible URL from the asyncpg DATABASE_URL."""
    return settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://", 1
    )


_sync_engine = create_engine(_make_sync_url(), pool_pre_ping=True)


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _fetch_workspace_nodes(session: Session, workspace_id: str) -> list[dict]:
    """Return all flow_nodes for the workspace, ordered by creation time."""
    rows = session.execute(
        text("""
            SELECT
                id::text          AS id,
                parent_id::text   AS parent_id,
                node_type,
                name,
                code,
                input_keys,
                output_key
            FROM flow_nodes
            WHERE workspace_id = :wid
            ORDER BY created_at
        """),
        {"wid": workspace_id},
    ).mappings().all()
    return [dict(r) for r in rows]


def _fetch_node_by_id(session: Session, node_id: str) -> dict | None:
    """Return a single flow_node row as a dict, or None if not found."""
    row = session.execute(
        text("""
            SELECT
                id::text            AS id,
                workspace_id::text  AS workspace_id,
                parent_id::text     AS parent_id,
                node_type,
                name,
                code,
                input_keys,
                output_key
            FROM flow_nodes
            WHERE id = :nid
        """),
        {"nid": node_id},
    ).mappings().first()
    return dict(row) if row else None


def _run_exists(session: Session, run_id: str, node_id: str | None = None) -> bool:
    """Check whether execution record(s) already exist for this run."""
    if node_id:
        row = session.execute(
            text("""
                SELECT 1 FROM executions
                WHERE run_id = :rid AND node_id = :nid
                LIMIT 1
            """),
            {"rid": run_id, "nid": node_id},
        ).first()
    else:
        row = session.execute(
            text("SELECT 1 FROM executions WHERE run_id = :rid LIMIT 1"),
            {"rid": run_id},
        ).first()
    return row is not None


def _fetch_execution(session: Session, run_id: str, node_id: str) -> dict | None:
    row = session.execute(
        text("""
            SELECT status, output_data, error_message, duration_ms
            FROM executions
            WHERE run_id = :rid AND node_id = :nid
            LIMIT 1
        """),
        {"rid": run_id, "nid": node_id},
    ).mappings().first()
    return dict(row) if row else None


def _write_execution(
    session: Session,
    *,
    workspace_id: str,
    run_id: str,
    node_id: str,
    status: str,
    input_data: dict,
    output_data: dict | None,
    error_message: str | None,
    duration_ms: int,
) -> None:
    session.execute(
        text("""
            INSERT INTO executions
                (id, workspace_id, run_id, node_id, status,
                 duration_ms, input_data, output_data, error_message, created_at)
            VALUES
                (:id,
                 :workspace_id::uuid,
                 :run_id::uuid,
                 :node_id::uuid,
                 :status,
                 :duration_ms,
                 :input_data::jsonb,
                 :output_data::jsonb,
                 :error_message,
                 :created_at)
        """),
        {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "run_id": run_id,
            "node_id": node_id,
            "status": status,
            "duration_ms": duration_ms,
            "input_data": json.dumps(input_data),
            "output_data": json.dumps(output_data) if output_data is not None else None,
            "error_message": error_message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    session.commit()


# ── Tree traversal ─────────────────────────────────────────────────────────────

def _build_tree_maps(
    nodes: list[dict],
) -> tuple[dict[str, dict], dict[str, list[str]], list[str]]:
    """
    Return:
      node_map:     id -> node dict
      children_map: parent_id -> [child_ids] (insertion-ordered)
      root_ids:     ids of nodes with no parent
    """
    node_map: dict[str, dict] = {n["id"]: n for n in nodes}
    children_map: dict[str, list[str]] = {}
    root_ids: list[str] = []

    for n in nodes:
        pid: str | None = n.get("parent_id")
        if pid:
            children_map.setdefault(pid, []).append(n["id"])
        else:
            root_ids.append(n["id"])

    return node_map, children_map, root_ids


def _dfs_preorder(
    node_id: str,
    node_map: dict[str, dict],
    children_map: dict[str, list[str]],
) -> list[dict]:
    """Pre-order DFS — parent visited before its children (mirrors Tree._run_node)."""
    result = [node_map[node_id]]
    for child_id in children_map.get(node_id, []):
        result.extend(_dfs_preorder(child_id, node_map, children_map))
    return result


# ── Step execution (mirrors Node.execute in main.py) ──────────────────────────

def _to_output_dict(value: object) -> dict | None:
    """Normalise any output value to a JSON-serialisable dict (or None)."""
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    return {"value": value}


def _execute_step(
    node: dict,
    context: dict,
) -> tuple[str, dict | None, str, int]:
    """
    Run one node.  Mirrors Node.execute() from main.py.

    Returns (status, output_dict, error_message, duration_ms).
    status is one of: SUCCESS | ERROR | SKIPPED
    """
    code: str = node.get("code") or ""
    if node["node_type"] != "step" or not code.strip():
        return "SKIPPED", None, "", 0

    input_keys: list[str] = node.get("input_keys") or []
    inputs = {k: context.get(k) for k in input_keys}
    namespace: dict = {"inputs": inputs, "output": None}

    start = time.perf_counter()
    try:
        exec(code, namespace)  # noqa: S102
        duration_ms = int((time.perf_counter() - start) * 1000)
        output = namespace.get("output")

        output_key: str = node.get("output_key") or ""
        if output_key and output is not None:
            context[output_key] = output

        return "SUCCESS", _to_output_dict(output), "", duration_ms

    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return "ERROR", None, str(exc), duration_ms


# ── Celery tasks ───────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="app.workers.tasks.execute_pipeline")
def execute_pipeline(
    self,  # noqa: ANN001
    workspace_id: str,
    run_id: str,
    initial_context: dict,
) -> dict:
    """
    Run all STEP nodes for a workspace in DFS pre-order.

    Non-STEP nodes are visited (to respect tree order) but produce a SKIPPED
    execution record rather than running code.

    Returns:
        {
          "run_id": str,
          "results": [
              {"node_id": str, "status": str, "output": dict|None,
               "duration_ms": int, "error": str},
              ...
          ]
        }
    """
    try:
        with Session(_sync_engine) as session:
            # Idempotency: abort if this run_id was already executed.
            if _run_exists(session, run_id):
                logger.warning(
                    "execute_pipeline called twice for run_id=%s — skipping", run_id
                )
                return {"run_id": run_id, "results": [], "skipped": True}

            all_nodes = _fetch_workspace_nodes(session, workspace_id)
            if not all_nodes:
                logger.warning(
                    "No nodes found for workspace_id=%s", workspace_id)
                return {"run_id": run_id, "results": []}

            node_map, children_map, root_ids = _build_tree_maps(all_nodes)

            # Build full DFS order across all roots.
            ordered: list[dict] = []
            for root_id in root_ids:
                ordered.extend(_dfs_preorder(root_id, node_map, children_map))

            context = dict(initial_context)
            results: list[dict] = []

            for node in ordered:
                input_keys: list[str] = node.get("input_keys") or []
                input_data = {k: context.get(k) for k in input_keys}

                status, output_data, error_message, duration_ms = _execute_step(
                    node, context
                )

                try:
                    _write_execution(
                        session=session,
                        workspace_id=workspace_id,
                        run_id=run_id,
                        node_id=node["id"],
                        status=status,
                        input_data=input_data,
                        output_data=output_data,
                        error_message=error_message or None,
                        duration_ms=duration_ms,
                    )
                except Exception as db_exc:
                    logger.error(
                        "Failed to write execution record for node=%s: %s",
                        node["id"],
                        db_exc,
                    )

                results.append(
                    {
                        "node_id": node["id"],
                        "status": status,
                        "output": output_data,
                        "duration_ms": duration_ms,
                        "error": error_message,
                    }
                )
                logger.info(
                    "node=%s status=%s duration=%dms",
                    node["name"],
                    status,
                    duration_ms,
                )

            return {"run_id": run_id, "results": results}

    except Exception as exc:
        logger.exception(
            "execute_pipeline failed: run_id=%s error=%s", run_id, exc)
        raise


@celery_app.task(bind=True, name="app.workers.tasks.execute_single_node")
def execute_single_node(
    self,  # noqa: ANN001
    node_id: str,
    run_id: str,
    input_data: dict,
) -> dict:
    """
    Run a single STEP node by ID.

    Returns one result element in the same shape as the items inside
    execute_pipeline's "results" list:
        {"node_id": str, "status": str, "output": dict|None,
         "duration_ms": int, "error": str}
    """
    try:
        with Session(_sync_engine) as session:
            # Idempotency: return cached result if this node already ran.
            if _run_exists(session, run_id, node_id):
                logger.warning(
                    "execute_single_node called twice for run_id=%s node_id=%s — skipping",
                    run_id,
                    node_id,
                )
                cached = _fetch_execution(session, run_id, node_id)
                if cached:
                    return {
                        "node_id": node_id,
                        "status": cached["status"],
                        "output": cached["output_data"],
                        "duration_ms": cached["duration_ms"],
                        "error": cached["error_message"] or "",
                    }
                return {
                    "node_id": node_id,
                    "status": "SKIPPED",
                    "output": None,
                    "duration_ms": 0,
                    "error": "",
                }

            node = _fetch_node_by_id(session, node_id)
            if node is None:
                raise ValueError(f"Node {node_id!r} not found")

            context = dict(input_data)
            status, output_data, error_message, duration_ms = _execute_step(
                node, context
            )

            try:
                _write_execution(
                    session=session,
                    workspace_id=node["workspace_id"],
                    run_id=run_id,
                    node_id=node_id,
                    status=status,
                    input_data=input_data,
                    output_data=output_data,
                    error_message=error_message or None,
                    duration_ms=duration_ms,
                )
            except Exception as db_exc:
                logger.error(
                    "Failed to write execution record for node=%s: %s", node_id, db_exc
                )

            return {
                "node_id": node_id,
                "status": status,
                "output": output_data,
                "duration_ms": duration_ms,
                "error": error_message,
            }

    except Exception as exc:
        logger.exception(
            "execute_single_node failed: run_id=%s node_id=%s error=%s",
            run_id,
            node_id,
            exc,
        )
        raise
