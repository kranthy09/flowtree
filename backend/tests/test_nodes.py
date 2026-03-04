"""Tests for /workspaces/{workspace_id}/nodes endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── helpers ────────────────────────────────────────────────────────────────


async def _create_workspace(client: AsyncClient, name: str = "Test WS") -> str:
    resp = await client.post("/workspaces", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_api_root(
    client: AsyncClient, workspace_id: str, name: str = "My API"
) -> str:
    resp = await client.post(
        f"/workspaces/{workspace_id}/nodes",
        json={"node_type": "api", "name": name},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ── TestCreateNode ─────────────────────────────────────────────────────────


class TestCreateNode:
    async def test_create_api_root_returns_201(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "api", "name": "User API"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["node_type"] == "api"
        assert data["name"] == "User API"
        assert data["workspace_id"] == ws_id
        assert data["parent_id"] is None

    async def test_create_endpoint_child_of_api(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)

        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={
                "node_type": "endpoint",
                "name": "Register",
                "parent_id": api_id,
                "method": "POST",
                "path": "/users/register",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["node_type"] == "endpoint"
        assert data["parent_id"] == api_id
        assert data["method"] == "POST"

    async def test_create_model_child_of_api(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)

        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={
                "node_type": "model",
                "name": "UserResponse",
                "parent_id": api_id,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["node_type"] == "model"

    async def test_create_field_child_of_endpoint_rejected(
        self, client: AsyncClient
    ):
        """field nodes cannot be direct children of endpoint nodes."""
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        ep_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP", "parent_id": api_id},
        )
        ep_id = ep_resp.json()["id"]

        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "field", "name": "email", "parent_id": ep_id},
        )
        assert resp.status_code == 422

    async def test_create_endpoint_without_parent_rejected(
        self, client: AsyncClient
    ):
        """Only api nodes may be root nodes (parent_id=null)."""
        ws_id = await _create_workspace(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "Orphan EP"},
        )
        assert resp.status_code == 422

    async def test_create_in_nonexistent_workspace_returns_404(
        self, client: AsyncClient
    ):
        resp = await client.post(
            "/workspaces/00000000-0000-0000-0000-000000000000/nodes",
            json={"node_type": "api", "name": "API"},
        )
        assert resp.status_code == 404

    async def test_create_with_nonexistent_parent_returns_404(
        self, client: AsyncClient
    ):
        ws_id = await _create_workspace(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={
                "node_type": "endpoint",
                "name": "EP",
                "parent_id": "00000000-0000-0000-0000-000000000000",
            },
        )
        assert resp.status_code == 404

    async def test_create_node_defaults(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "api", "name": "Minimal"},
        )
        data = resp.json()
        assert data["position_x"] == 0.0
        assert data["position_y"] == 0.0
        assert data["nullable"] is False
        assert data["deprecated"] is False
        assert data["tags"] == []


# ── TestListNodes ──────────────────────────────────────────────────────────


class TestListNodes:
    async def test_empty_list(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.get(f"/workspaces/{ws_id}/nodes")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_flat_list(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP", "parent_id": api_id},
        )
        resp = await client.get(f"/workspaces/{ws_id}/nodes")
        assert resp.status_code == 200
        nodes = resp.json()
        assert len(nodes) == 2  # api + endpoint
        types = {n["node_type"] for n in nodes}
        assert types == {"api", "endpoint"}

    async def test_flat_list_children_empty(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        await _create_api_root(client, ws_id)
        nodes = (await client.get(f"/workspaces/{ws_id}/nodes")).json()
        assert nodes[0]["children"] == []


# ── TestGetTree ────────────────────────────────────────────────────────────


class TestGetTree:
    async def test_tree_empty_workspace_returns_404(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.get(f"/workspaces/{ws_id}/nodes/tree")
        assert resp.status_code == 404

    async def test_tree_has_nested_children(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP1", "parent_id": api_id},
        )
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "model", "name": "M1", "parent_id": api_id},
        )

        resp = await client.get(f"/workspaces/{ws_id}/nodes/tree")
        assert resp.status_code == 200
        tree = resp.json()
        assert tree["node_type"] == "api"
        assert len(tree["children"]) == 2

    async def test_tree_deep_nesting(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        ep_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP", "parent_id": api_id},
        )
        ep_id = ep_resp.json()["id"]
        req_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "request", "name": "REQ", "parent_id": ep_id},
        )
        req_id = req_resp.json()["id"]
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={
                "node_type": "field",
                "name": "email",
                "parent_id": req_id,
                "field_type": "string",
            },
        )

        tree = (await client.get(f"/workspaces/{ws_id}/nodes/tree")).json()
        ep = tree["children"][0]
        assert ep["node_type"] == "endpoint"
        req = ep["children"][0]
        assert req["node_type"] == "request"
        field = req["children"][0]
        assert field["node_type"] == "field"
        assert field["name"] == "email"


# ── TestUpdateNode ─────────────────────────────────────────────────────────


class TestUpdateNode:
    async def test_update_name(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id, "Old Name")
        resp = await client.put(
            f"/workspaces/{ws_id}/nodes/{api_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    async def test_update_position(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        resp = await client.put(
            f"/workspaces/{ws_id}/nodes/{api_id}",
            json={"position_x": 120.5, "position_y": 80.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["position_x"] == 120.5
        assert data["position_y"] == 80.0

    async def test_update_nullable_flag(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        ep_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP", "parent_id": api_id},
        )
        ep_id = ep_resp.json()["id"]
        req_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "request", "name": "REQ", "parent_id": ep_id},
        )
        req_id = req_resp.json()["id"]
        field_resp = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={
                "node_type": "field",
                "name": "age",
                "parent_id": req_id,
                "field_type": "integer",
            },
        )
        field_id = field_resp.json()["id"]

        resp = await client.put(
            f"/workspaces/{ws_id}/nodes/{field_id}",
            json={"nullable": True},
        )
        assert resp.status_code == 200
        assert resp.json()["nullable"] is True

    async def test_update_not_found(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.put(
            f"/workspaces/{ws_id}/nodes/00000000-0000-0000-0000-000000000000",
            json={"name": "X"},
        )
        assert resp.status_code == 404

    async def test_update_wrong_workspace_returns_404(
        self, client: AsyncClient
    ):
        ws1 = await _create_workspace(client, "WS1")
        ws2 = await _create_workspace(client, "WS2")
        api_id = await _create_api_root(client, ws1)

        resp = await client.put(
            f"/workspaces/{ws2}/nodes/{api_id}",
            json={"name": "Hijack"},
        )
        assert resp.status_code == 404


# ── TestDeleteNode ─────────────────────────────────────────────────────────


class TestDeleteNode:
    async def test_delete_returns_204(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        resp = await client.delete(f"/workspaces/{ws_id}/nodes/{api_id}")
        assert resp.status_code == 204

    async def test_delete_cascades_children(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        api_id = await _create_api_root(client, ws_id)
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "endpoint", "name": "EP", "parent_id": api_id},
        )
        await client.delete(f"/workspaces/{ws_id}/nodes/{api_id}")

        nodes = (await client.get(f"/workspaces/{ws_id}/nodes")).json()
        assert nodes == []  # endpoint was cascade-deleted too

    async def test_delete_not_found(self, client: AsyncClient):
        ws_id = await _create_workspace(client)
        resp = await client.delete(
            f"/workspaces/{ws_id}/nodes/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404
