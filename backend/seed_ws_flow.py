#!/usr/bin/env python3
"""
Seed a complete 'POST /workspaces' flow tree in the FlowTree canvas.

Run inside the container:
    docker compose exec backend python seed_ws_flow.py
"""
from __future__ import annotations

import asyncio
import httpx

BASE = "http://localhost:8000"


# ── helpers ───────────────────────────────────────────────────────────────────


async def post(client: httpx.AsyncClient, url: str, body: dict) -> dict:
    resp = await client.post(url, json=body)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"POST {url}  →  {resp.status_code}\n{resp.text}")
    return resp.json()


# ── main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as client:

        # ── 1. Workspace ───────────────────────────────────────────────────────
        ws = await post(client, "/workspaces", {
            "name": "Workspace Service",
            "description": "Complete flow for POST /workspaces — Route → Service → Repository → DB",
        })
        wid = ws["id"]
        print(f"Workspace created: {wid}")

        async def n(body: dict) -> dict:
            return await post(client, f"/workspaces/{wid}/nodes", body)

        # ── 2. API root ────────────────────────────────────────────────────────
        api = await n({
            "node_type": "api",
            "name": "Workspace Service",
            "title": "Workspace Service",
            "version": "1.0.0",
            "base_url": "http://localhost:8000",
            "tech_stack": "FastAPI, PostgreSQL 16, SQLAlchemy 2.0 async, Pydantic v2, Alembic",
            "auth_scheme": "none",
            "architecture_notes": (
                "Route → Service → Repository pattern.\n"
                "All DB calls are async (asyncpg + SQLAlchemy 2.0).\n"
                "Workspace ORM owns FlowNodes and Executions via FK CASCADE delete.\n"
                "Alembic manages schema migrations."
            ),
            "description": "CRUD service for FlowTree workspaces. Each workspace is an isolated canvas of FlowNodes.",
            "position_x": 800.0,
            "position_y": 0.0,
        })
        api_id = api["id"]
        print(f"  [api]      Workspace Service")

        # ── 3. Endpoint: POST /workspaces ──────────────────────────────────────
        ep = await n({
            "node_type": "endpoint",
            "name": "Create Workspace",
            "method": "POST",
            "path": "/workspaces",
            "summary": "Create a new workspace",
            "operation_id": "create_workspace",
            "is_async": True,
            "deprecated": False,
            "service_method": "workspace_service.create_workspace(db, data)",
            "database_query": (
                "INSERT INTO workspaces (id, name, description, created_at, updated_at)\n"
                "VALUES (uuid4(), :name, :description, now(), now())\n"
                "RETURNING *"
            ),
            "description": (
                "1. FastAPI parses + validates WorkspaceCreate body (Pydantic v2).\n"
                "2. AsyncSession injected via Depends(get_db).\n"
                "3. Calls workspace_service.create_workspace(db, data).\n"
                "4. Service calls workspace_repo.create_workspace(db, data).\n"
                "5. Repo: db.add(Workspace(name, description)) → db.commit() → db.refresh().\n"
                "6. Service wraps ORM result → WorkspaceDetailResponse(node_count=0, nodes=[]).\n"
                "7. Returns HTTP 201 Created."
            ),
            "parent_id": api_id,
            "position_x": 800.0,
            "position_y": 280.0,
        })
        ep_id = ep["id"]
        print(f"  [endpoint] POST /workspaces")

        # ── 4. Request Body ────────────────────────────────────────────────────
        req = await n({
            "node_type": "request",
            "name": "WorkspaceCreate",
            "content_type": "application/json",
            "description": (
                "Pydantic v2 model. FastAPI validates before the handler runs.\n"
                "On failure, FastAPI returns 422 Unprocessable Entity automatically."
            ),
            "parent_id": ep_id,
            "position_x": 280.0,
            "position_y": 520.0,
        })
        req_id = req["id"]
        print(f"  [request]  WorkspaceCreate body")

        req_fields = [
            {
                "name": "name",
                "field_type": "string",
                "required": True,
                "nullable": False,
                "description": "Workspace display name — validated: 1 ≤ len ≤ 255",
                "constraints": {"minLength": 1, "maxLength": 255},
            },
            {
                "name": "description",
                "field_type": "string",
                "required": False,
                "nullable": True,
                "description": "Optional free-text description (stored as TEXT, nullable)",
            },
        ]
        for i, f in enumerate(req_fields):
            await n({
                **f,
                "node_type": "field",
                "parent_id": req_id,
                "position_x": 280.0,
                "position_y": 720.0 + i * 90.0,
            })
        print(f"    [field]  name, description")

        # ── 5. Response 201 Created ────────────────────────────────────────────
        r201 = await n({
            "node_type": "response",
            "name": "Workspace Created",
            "status_code": 201,
            "is_error": False,
            "content_type": "application/json",
            "model_ref": "WorkspaceDetailResponse",
            "description": (
                "Workspace persisted to PostgreSQL.\n"
                "node_count is always 0 and nodes is [] for a brand-new workspace."
            ),
            "parent_id": ep_id,
            "position_x": 900.0,
            "position_y": 520.0,
        })
        r201_id = r201["id"]
        print(f"  [response] 201 Workspace Created")

        r201_fields = [
            {"name": "id",          "field_type": "string",  "field_format": "uuid",       "required": True,  "nullable": False, "read_only": True,  "description": "UUID4 of the new workspace"},
            {"name": "name",        "field_type": "string",                                 "required": True,  "nullable": False,                     "description": "Name as submitted"},
            {"name": "description", "field_type": "string",                                 "required": False, "nullable": True,                      "description": "Description as submitted (or null)"},
            {"name": "created_at",  "field_type": "string",  "field_format": "date-time",  "required": True,  "nullable": False, "read_only": True,  "description": "PostgreSQL server-generated timestamp"},
            {"name": "updated_at",  "field_type": "string",  "field_format": "date-time",  "required": True,  "nullable": False, "read_only": True,  "description": "Equals created_at immediately after creation"},
            {"name": "node_count",  "field_type": "integer",                                "required": True,  "nullable": False,                     "description": "Always 0 — no nodes yet"},
            {"name": "nodes",       "field_type": "array",   "items_type": "FlowNodeSummary", "required": True, "nullable": False,                   "description": "Always [] — empty canvas"},
        ]
        for i, f in enumerate(r201_fields):
            await n({
                **f,
                "node_type": "field",
                "parent_id": r201_id,
                "position_x": 900.0,
                "position_y": 720.0 + i * 90.0,
            })
        print(f"    [field]  id, name, description, created_at, updated_at, node_count, nodes")

        # ── 6. Response 422 Validation Error ──────────────────────────────────
        r422 = await n({
            "node_type": "response",
            "name": "Validation Error",
            "status_code": 422,
            "is_error": True,
            "content_type": "application/json",
            "error_type": "RequestValidationError",
            "description": (
                "Auto-emitted by FastAPI when Pydantic v2 validation fails.\n"
                "Examples: name missing, name is empty string, name longer than 255 chars."
            ),
            "parent_id": ep_id,
            "position_x": 1280.0,
            "position_y": 520.0,
        })
        r422_id = r422["id"]
        print(f"  [response] 422 Validation Error")

        await n({
            "node_type": "field",
            "name": "detail",
            "field_type": "array",
            "items_type": "ValidationError",
            "required": True,
            "nullable": False,
            "description": "Per-field error objects: { loc: string[], msg: string, type: string }",
            "parent_id": r422_id,
            "position_x": 1280.0,
            "position_y": 720.0,
        })
        print(f"    [field]  detail")

        # ── 7. Model: Workspace (ORM) ──────────────────────────────────────────
        m_ws = await n({
            "node_type": "model",
            "name": "Workspace",
            "description": (
                "SQLAlchemy 2.0 ORM model mapped to the 'workspaces' table.\n"
                "Relationships: nodes (FlowNode, cascade all+delete-orphan, lazy=selectin), "
                "executions (Execution, cascade all+delete-orphan)."
            ),
            "base_class": "Base",
            "orm_table": "workspaces",
            "parent_id": api_id,
            "position_x": 0.0,
            "position_y": 600.0,
        })
        m_ws_id = m_ws["id"]
        print(f"  [model]    Workspace")

        workspace_fields = [
            {"name": "id",          "field_type": "string",  "field_format": "uuid",      "required": True,  "nullable": False, "read_only": True,  "description": "PK — UUID4 default via Python"},
            {"name": "name",        "field_type": "string",                                "required": True,  "nullable": False,                     "description": "String(255), NOT NULL",            "constraints": {"maxLength": 255}},
            {"name": "description", "field_type": "string",                                "required": False, "nullable": True,                      "description": "Text column, nullable"},
            {"name": "created_at",  "field_type": "string",  "field_format": "date-time", "required": True,  "nullable": False, "read_only": True,  "description": "server_default=func.now()"},
            {"name": "updated_at",  "field_type": "string",  "field_format": "date-time", "required": True,  "nullable": False, "read_only": True,  "description": "server_default + onupdate=func.now()"},
        ]
        for i, f in enumerate(workspace_fields):
            await n({
                **f,
                "node_type": "field",
                "parent_id": m_ws_id,
                "position_x": 0.0,
                "position_y": 800.0 + i * 90.0,
            })
        print(f"    [field]  id, name, description, created_at, updated_at")

        # ── 8. Model: WorkspaceDetailResponse ─────────────────────────────────
        m_dr = await n({
            "node_type": "model",
            "name": "WorkspaceDetailResponse",
            "description": (
                "Pydantic v2 response schema. Inherits WorkspaceResponse.\n"
                "Returned by POST /workspaces and GET /workspaces/{id}.\n"
                "Built via model_validate(ws).model_copy(update={node_count, nodes})."
            ),
            "base_class": "WorkspaceResponse",
            "parent_id": api_id,
            "position_x": 480.0,
            "position_y": 600.0,
        })
        m_dr_id = m_dr["id"]
        print(f"  [model]    WorkspaceDetailResponse")

        detail_fields = [
            {"name": "id",          "field_type": "string",  "field_format": "uuid",         "required": True,  "nullable": False, "read_only": True},
            {"name": "name",        "field_type": "string",                                   "required": True,  "nullable": False},
            {"name": "description", "field_type": "string",                                   "required": False, "nullable": True},
            {"name": "created_at",  "field_type": "string",  "field_format": "date-time",    "required": True,  "nullable": False, "read_only": True},
            {"name": "updated_at",  "field_type": "string",  "field_format": "date-time",    "required": True,  "nullable": False, "read_only": True},
            {"name": "node_count",  "field_type": "integer",                                  "required": True,  "nullable": False,                     "description": "default=0"},
            {"name": "nodes",       "field_type": "array",   "items_type": "FlowNodeSummary","required": True,  "nullable": False,                     "description": "default=[]"},
        ]
        for i, f in enumerate(detail_fields):
            await n({
                **f,
                "node_type": "field",
                "parent_id": m_dr_id,
                "position_x": 480.0,
                "position_y": 800.0 + i * 90.0,
            })
        print(f"    [field]  id, name, description, created_at, updated_at, node_count, nodes")

        # ── done ───────────────────────────────────────────────────────────────
        print(f"\n✓ Flow seeded successfully.")
        print(f"  Open: http://localhost:3000/workspace/{wid}")


asyncio.run(main())
