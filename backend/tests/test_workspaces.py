import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestListWorkspaces:
    async def test_empty_list(self, client: AsyncClient):
        resp = await client.get("/workspaces")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_created_workspace(self, client: AsyncClient):
        await client.post("/workspaces", json={"name": "WS A"})
        await client.post("/workspaces", json={"name": "WS B"})
        resp = await client.get("/workspaces")
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert "WS A" in names
        assert "WS B" in names

    async def test_node_count_is_zero_for_new_workspace(self, client: AsyncClient):
        await client.post("/workspaces", json={"name": "Count WS"})
        resp = await client.get("/workspaces")
        ws = next(w for w in resp.json() if w["name"] == "Count WS")
        assert ws["node_count"] == 0


class TestCreateWorkspace:
    async def test_create_returns_201(self, client: AsyncClient):
        resp = await client.post("/workspaces", json={"name": "New WS"})
        assert resp.status_code == 201

    async def test_create_returns_workspace_fields(self, client: AsyncClient):
        resp = await client.post(
            "/workspaces",
            json={"name": "My API", "description": "A test workspace"},
        )
        data = resp.json()
        assert data["name"] == "My API"
        assert data["description"] == "A test workspace"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert data["nodes"] == []

    async def test_create_without_description(self, client: AsyncClient):
        resp = await client.post("/workspaces", json={"name": "No Desc"})
        assert resp.status_code == 201
        assert resp.json()["description"] is None

    async def test_create_name_required(self, client: AsyncClient):
        resp = await client.post("/workspaces", json={})
        assert resp.status_code == 422

    async def test_create_name_empty_string_rejected(self, client: AsyncClient):
        resp = await client.post("/workspaces", json={"name": ""})
        assert resp.status_code == 422

    async def test_create_name_too_long_rejected(self, client: AsyncClient):
        resp = await client.post("/workspaces", json={"name": "x" * 256})
        assert resp.status_code == 422


class TestGetWorkspace:
    async def test_get_existing_workspace(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Get Me"})
        ws_id = create.json()["id"]

        resp = await client.get(f"/workspaces/{ws_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == ws_id
        assert data["name"] == "Get Me"
        assert "nodes" in data

    async def test_get_returns_empty_nodes_list(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Empty Nodes"})
        ws_id = create.json()["id"]
        resp = await client.get(f"/workspaces/{ws_id}")
        assert resp.json()["nodes"] == []

    async def test_get_not_found(self, client: AsyncClient):
        resp = await client.get("/workspaces/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    async def test_get_invalid_uuid(self, client: AsyncClient):
        resp = await client.get("/workspaces/not-a-uuid")
        assert resp.status_code == 422


class TestUpdateWorkspace:
    async def test_update_name(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Old Name"})
        ws_id = create.json()["id"]

        resp = await client.put(f"/workspaces/{ws_id}", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    async def test_update_description(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "WS"})
        ws_id = create.json()["id"]

        resp = await client.put(
            f"/workspaces/{ws_id}", json={"description": "Updated desc"}
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated desc"

    async def test_update_not_found(self, client: AsyncClient):
        resp = await client.put(
            "/workspaces/00000000-0000-0000-0000-000000000000",
            json={"name": "X"},
        )
        assert resp.status_code == 404

    async def test_update_name_too_long_rejected(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "WS"})
        ws_id = create.json()["id"]
        resp = await client.put(f"/workspaces/{ws_id}", json={"name": "x" * 256})
        assert resp.status_code == 422


class TestDeleteWorkspace:
    async def test_delete_returns_204(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Delete Me"})
        ws_id = create.json()["id"]

        resp = await client.delete(f"/workspaces/{ws_id}")
        assert resp.status_code == 204

    async def test_delete_makes_workspace_unreachable(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Gone"})
        ws_id = create.json()["id"]

        await client.delete(f"/workspaces/{ws_id}")
        resp = await client.get(f"/workspaces/{ws_id}")
        assert resp.status_code == 404

    async def test_delete_not_found(self, client: AsyncClient):
        resp = await client.delete("/workspaces/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    async def test_delete_removes_from_list(self, client: AsyncClient):
        create = await client.post("/workspaces", json={"name": "Remove Me"})
        ws_id = create.json()["id"]

        await client.delete(f"/workspaces/{ws_id}")
        resp = await client.get("/workspaces")
        ids = [w["id"] for w in resp.json()]
        assert ws_id not in ids
