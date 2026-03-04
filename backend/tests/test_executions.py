"""Tests for /workspaces/{workspace_id}/run and /executions endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── helpers ────────────────────────────────────────────────────────────────


async def _create_workspace(client: AsyncClient, name: str = "Exec WS") -> str:
    resp = await client.post("/workspaces", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_api_root(client: AsyncClient, ws_id: str) -> str:
    resp = await client.post(
        f"/workspaces/{ws_id}/nodes",
        json={"node_type": "api", "name": "My API"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _mock_task(task_id: str = "fake-task-id") -> MagicMock:
    """Return a mock apply_async result with a predictable .id."""
    result = MagicMock()
    result.id = task_id
    return result


# ── TestRunPipeline ────────────────────────────────────────────────────────


class TestRunPipeline:
    async def test_dispatch_pipeline_returns_202(self, client: AsyncClient):
        ws_id = await _create_workspace(client)

        with patch("app.services.execution_service.execute_pipeline") as mock_ep:
            mock_ep.apply_async.return_value = _mock_task("pipeline-task-1")
            resp = await client.post(
                f"/workspaces/{ws_id}/run",
                json={"initial_context": {"key": "value"}},
            )

        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "queued"
        assert data["task_id"] == "pipeline-task-1"
        assert "run_id" in data

    async def test_dispatch_pipeline_passes_initial_context(self, client: AsyncClient):
        ws_id = await _create_workspace(client)

        with patch("app.services.execution_service.execute_pipeline") as mock_ep:
            mock_ep.apply_async.return_value = _mock_task()
            await client.post(
                f"/workspaces/{ws_id}/run",
                json={"initial_context": {"x": 42}},
            )

        call_args = mock_ep.apply_async.call_args
        # args=[workspace_id_str, run_id_str, initial_context]
        assert call_args.kwargs["args"][0] == ws_id
        assert call_args.kwargs["args"][2] == {"x": 42}

    async def test_dispatch_single_node_returns_202(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)

        with patch("app.services.execution_service.execute_single_node") as mock_sn:
            mock_sn.apply_async.return_value = _mock_task("single-task-1")
            resp = await client.post(
                f"/workspaces/{ws_id}/run",
                json={"node_id": api_id, "initial_context": {}},
            )

        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "queued"
        assert data["task_id"] == "single-task-1"

    async def test_dispatch_single_node_passes_node_id(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)

        with patch("app.services.execution_service.execute_single_node") as mock_sn:
            mock_sn.apply_async.return_value = _mock_task()
            await client.post(
                f"/workspaces/{ws_id}/run",
                json={"node_id": api_id, "initial_context": {"data": 1}},
            )

        call_args = mock_sn.apply_async.call_args
        # args=[node_id_str, run_id_str, input_data]
        assert call_args.kwargs["args"][0] == api_id
        assert call_args.kwargs["args"][2] == {"data": 1}

    async def test_run_id_is_unique_per_dispatch(self, client: AsyncClient):
        ws_id = await _create_workspace(client)

        with patch("app.services.execution_service.execute_pipeline") as mock_ep:
            mock_ep.apply_async.return_value = _mock_task()
            r1 = await client.post(f"/workspaces/{ws_id}/run", json={})
            r2 = await client.post(f"/workspaces/{ws_id}/run", json={})

        assert r1.json()["run_id"] != r2.json()["run_id"]

    async def test_empty_body_uses_defaults(self, client: AsyncClient):
        ws_id = await _create_workspace(client)

        with patch("app.services.execution_service.execute_pipeline") as mock_ep:
            mock_ep.apply_async.return_value = _mock_task()
            resp = await client.post(f"/workspaces/{ws_id}/run", json={})

        assert resp.status_code == 202


# ── TestListExecutions ─────────────────────────────────────────────────────


class TestListExecutions:
    async def test_empty_list_for_new_workspace(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.get(f"/workspaces/{ws_id}/executions")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_200(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.get(f"/workspaces/{ws_id}/executions")
        assert resp.status_code == 200


# ── TestGetExecution ───────────────────────────────────────────────────────


class TestGetExecution:
    async def test_nonexistent_run_returns_404(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.get(
            f"/workspaces/{ws_id}/executions/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404

    async def test_wrong_workspace_returns_404(self, client: AsyncClient):
        ws1 = await _create_workspace(client, "WS1")
        ws2 = await _create_workspace(client, "WS2")
        # A random run_id that doesn't exist in ws2
        resp = await client.get(
            f"/workspaces/{ws2}/executions/00000000-0000-0000-0000-000000000001"
        )
        assert resp.status_code == 404
