"""Tests for /workspaces/{workspace_id}/export/* endpoints."""

import json

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ── helpers ────────────────────────────────────────────────────────────────


async def _build_minimal_tree(client: AsyncClient) -> str:
    """Create workspace + api → endpoint → request → field.  Returns workspace_id."""
    ws = await client.post("/workspaces", json={"name": "Export WS"})
    assert ws.status_code == 201
    ws_id = ws.json()["id"]

    api = await client.post(
        f"/workspaces/{ws_id}/nodes",
        json={
            "node_type": "api",
            "name":      "Test API",
            "title":     "Test API",
            "version":   "1.0.0",
            "base_url":  "https://api.example.com",
        },
    )
    assert api.status_code == 201
    api_id = api.json()["id"]

    ep = await client.post(
        f"/workspaces/{ws_id}/nodes",
        json={
            "node_type": "endpoint",
            "name":      "Get Users",
            "parent_id": api_id,
            "method":    "GET",
            "path":      "/users",
        },
    )
    assert ep.status_code == 201
    ep_id = ep.json()["id"]

    req = await client.post(
        f"/workspaces/{ws_id}/nodes",
        json={
            "node_type": "request",
            "name":      "CreateUserBody",
            "parent_id": ep_id,
        },
    )
    assert req.status_code == 201
    req_id = req.json()["id"]

    field = await client.post(
        f"/workspaces/{ws_id}/nodes",
        json={
            "node_type":    "field",
            "name":         "email",
            "parent_id":    req_id,
            "field_type":   "string",
            "field_format": "email",
        },
    )
    assert field.status_code == 201

    return ws_id


# ── TestExportOpenAPI ──────────────────────────────────────────────────────


class TestExportOpenAPI:
    async def test_returns_200_with_json_format(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "json"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["format"] == "json"
        assert data["filename"] == "openapi.json"

    async def test_openapi_spec_structure(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "json"},
        )
        spec = json.loads(resp.json()["content"])
        assert spec["openapi"] == "3.0.3"
        assert spec["info"]["title"] == "Test API"
        assert spec["info"]["version"] == "1.0.0"
        assert "/users" in spec["paths"]
        assert "get" in spec["paths"]["/users"]

    async def test_openapi_request_body_has_field(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "json"},
        )
        spec = json.loads(resp.json()["content"])
        op = spec["paths"]["/users"]["get"]
        assert "requestBody" in op
        schema = op["requestBody"]["content"]["application/json"]["schema"]
        assert "email" in schema["properties"]
        assert schema["properties"]["email"]["format"] == "email"

    async def test_openapi_yaml_output(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "yaml"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["format"] == "yaml"
        assert data["filename"] == "openapi.yaml"
        assert "openapi: 3.0.3" in data["content"]

    async def test_openapi_model_in_components(self, client: AsyncClient):
        ws = await client.post("/workspaces", json={"name": "Model WS"})
        ws_id = ws.json()["id"]
        api = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "api", "name": "Model API"},
        )
        api_id = api.json()["id"]
        model = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "model", "name": "UserModel", "parent_id": api_id},
        )
        model_id = model.json()["id"]
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "field", "name": "id", "parent_id": model_id, "field_type": "string"},
        )
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "json"},
        )
        spec = json.loads(resp.json()["content"])
        assert "UserModel" in spec["components"]["schemas"]
        assert "id" in spec["components"]["schemas"]["UserModel"]["properties"]

    async def test_export_empty_workspace_returns_empty_spec(self, client: AsyncClient):
        ws = await client.post("/workspaces", json={"name": "Empty WS"})
        ws_id = ws.json()["id"]
        resp = await client.post(
            f"/workspaces/{ws_id}/export/openapi",
            json={"output_format": "json"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "{}"


# ── TestExportSchema ───────────────────────────────────────────────────────


class TestExportSchema:
    async def test_json_schema_draft_07(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(f"/workspaces/{ws_id}/export/schema", json={})
        assert resp.status_code == 200
        schema = json.loads(resp.json()["content"])
        assert schema["$schema"] == "https://json-schema.org/draft-07/schema#"
        assert schema["title"] == "CreateUserBody"

    async def test_json_schema_has_email_field(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(f"/workspaces/{ws_id}/export/schema", json={})
        schema = json.loads(resp.json()["content"])
        assert "email" in schema.get("properties", {})
        assert schema["properties"]["email"]["format"] == "email"

    async def test_json_schema_by_model_name(self, client: AsyncClient):
        ws = await client.post("/workspaces", json={"name": "Schema WS"})
        ws_id = ws.json()["id"]
        api = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "api", "name": "Schema API"},
        )
        api_id = api.json()["id"]
        model = await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "model", "name": "UserSchema", "parent_id": api_id},
        )
        model_id = model.json()["id"]
        await client.post(
            f"/workspaces/{ws_id}/nodes",
            json={"node_type": "field", "name": "username", "parent_id": model_id, "field_type": "string"},
        )
        resp = await client.post(
            f"/workspaces/{ws_id}/export/schema",
            json={"model_name": "UserSchema"},
        )
        schema = json.loads(resp.json()["content"])
        assert schema["title"] == "UserSchema"
        assert "username" in schema["properties"]

    async def test_json_schema_empty_workspace_returns_empty(self, client: AsyncClient):
        ws = await client.post("/workspaces", json={"name": "Empty"})
        ws_id = ws.json()["id"]
        resp = await client.post(f"/workspaces/{ws_id}/export/schema", json={})
        assert resp.json()["content"] == "{}"


# ── TestExportPrompt ───────────────────────────────────────────────────────


class TestExportPrompt:
    async def test_prompt_contains_api_title(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(f"/workspaces/{ws_id}/export/prompt", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["format"] == "markdown"
        assert data["filename"] == "prompt.md"
        assert "Test API" in data["content"]

    async def test_prompt_contains_endpoint(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(f"/workspaces/{ws_id}/export/prompt", json={})
        assert "GET /users" in resp.json()["content"]

    async def test_prompt_contains_field_table(self, client: AsyncClient):
        ws_id = await _build_minimal_tree(client)
        resp = await client.post(f"/workspaces/{ws_id}/export/prompt", json={})
        content = resp.json()["content"]
        assert "email" in content
        assert "string(email)" in content  # field_format renders as type(format)

    async def test_prompt_empty_workspace(self, client: AsyncClient):
        ws = await client.post("/workspaces", json={"name": "Empty"})
        ws_id = ws.json()["id"]
        resp = await client.post(f"/workspaces/{ws_id}/export/prompt", json={})
        assert resp.status_code == 200
        assert resp.json()["content"] == ""
