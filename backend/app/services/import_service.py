"""Parse an OpenAPI 3.0 JSON/YAML spec into FlowTree FlowNode objects."""
from __future__ import annotations

import json
import uuid
from typing import Any

import yaml

from app.models.node import FlowNode
from app.schemas.node import NodeCreate


# ── Internal helpers ──────────────────────────────────────────────────────────


def parse_spec(content: str) -> dict[str, Any]:
    """Accept raw JSON or YAML and return a dict."""
    stripped = content.strip()
    if stripped.startswith(("{", "[")):
        return json.loads(stripped)
    return yaml.safe_load(stripped)


def _resolve_ref(ref: str, components: dict[str, Any]) -> dict[str, Any]:
    """Resolve '#/components/schemas/Foo' using the components dict."""
    # ref = "#/components/schemas/Foo"
    # parts after strip = ["components", "schemas", "Foo"]
    parts = ref.lstrip("#/").split("/")
    result: Any = {"components": components}
    for part in parts:
        result = result.get(part, {}) if isinstance(result, dict) else {}
    return result if isinstance(result, dict) else {}


def _resolve_schema(obj: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    if "$ref" in obj:
        return _resolve_ref(obj["$ref"], components)
    return obj


def _make(
    workspace_id: uuid.UUID,
    node_type: str,
    name: str,
    **kwargs: Any,
) -> FlowNode:
    """Build a FlowNode via NodeCreate so all schema defaults are applied correctly."""
    nc = NodeCreate.model_validate({"node_type": node_type, "name": name or "Unnamed", **kwargs})
    fields = nc.model_dump()
    fields["nullable_field"] = fields.pop("nullable")
    return FlowNode(id=uuid.uuid4(), workspace_id=workspace_id, **fields)


def _field_nodes(
    properties: dict[str, Any],
    required_fields: list[str],
    parent_id: uuid.UUID,
    workspace_id: uuid.UUID,
    components: dict[str, Any],
    x: float,
    y: float,
) -> list[FlowNode]:
    nodes: list[FlowNode] = []
    for i, (field_name, raw_schema) in enumerate(properties.items()):
        fs = _resolve_schema(raw_schema, components)
        f_type = fs.get("type", "string")
        f_format = fs.get("format")
        nodes.append(
            _make(
                workspace_id,
                "field",
                field_name,
                parent_id=parent_id,
                position_x=x,
                position_y=y + i * 90.0,
                field_type=f_type,
                field_format=f_format,
                required=(field_name in required_fields),
                nullable=fs.get("nullable", False),
                description=fs.get("description"),
                constraints={},
            )
        )
    return nodes


# ── Public API ────────────────────────────────────────────────────────────────


def from_openapi(content: str, workspace_id: uuid.UUID) -> list[FlowNode]:
    """Parse a JSON/YAML OpenAPI 3.0 spec string.

    Returns a flat list of FlowNode ORM objects with pre-assigned UUIDs and
    parent_id links.  The caller is responsible for persisting them inside a
    single transaction.
    """
    spec: dict[str, Any] = parse_spec(content)
    components: dict[str, Any] = spec.get("components", {})
    schemas: dict[str, Any] = components.get("schemas", {})
    info: dict[str, Any] = spec.get("info", {})
    paths: dict[str, Any] = spec.get("paths", {})
    servers: list[dict[str, Any]] = spec.get("servers", [])

    nodes: list[FlowNode] = []

    # ── 1. API root ───────────────────────────────────────────────────────────
    base_url = servers[0].get("url", "") if servers else ""

    auth_scheme: str | None = None
    for scheme_obj in components.get("securitySchemes", {}).values():
        auth_scheme = scheme_obj.get("type") or scheme_obj.get("scheme")
        break

    api_node = _make(
        workspace_id,
        "api",
        info.get("title", "Imported API"),
        position_x=500.0,
        position_y=0.0,
        title=info.get("title"),
        version=info.get("version", "1.0.0"),
        base_url=base_url,
        description=info.get("description"),
        auth_scheme=auth_scheme,
    )
    nodes.append(api_node)

    # ── 2. Model nodes (components/schemas) ───────────────────────────────────
    for model_idx, (schema_name, raw_schema) in enumerate(schemas.items()):
        schema_obj = _resolve_schema(raw_schema, components)
        model_x = model_idx * 320.0
        model_node = _make(
            workspace_id,
            "model",
            schema_name,
            parent_id=api_node.id,
            position_x=model_x,
            position_y=550.0,
            description=schema_obj.get("description"),
        )
        nodes.append(model_node)
        nodes.extend(
            _field_nodes(
                schema_obj.get("properties", {}),
                schema_obj.get("required", []),
                model_node.id,
                workspace_id,
                components,
                model_x,
                720.0,
            )
        )

    # ── 3. Endpoint + Request / Response nodes ────────────────────────────────
    HTTP_METHODS = ("get", "post", "put", "patch", "delete", "options", "head")
    ep_idx = 0

    for path, path_item in paths.items():
        for method in HTTP_METHODS:
            op: dict[str, Any] | None = path_item.get(method)
            if not op:
                continue

            ep_x = ep_idx * 380.0
            ep_node = _make(
                workspace_id,
                "endpoint",
                op.get("summary") or f"{method.upper()} {path}",
                parent_id=api_node.id,
                position_x=ep_x,
                position_y=-150.0,
                method=method.upper(),
                path=path,
                summary=op.get("summary"),
                operation_id=op.get("operationId"),
                deprecated=op.get("deprecated", False),
                description=op.get("description"),
            )
            nodes.append(ep_node)

            # Request body
            req_body = op.get("requestBody", {})
            if req_body:
                ct_map = req_body.get("content", {})
                first_ct = next(iter(ct_map), "application/json")
                body_schema = _resolve_schema(
                    ct_map.get(first_ct, {}).get("schema", {}), components
                )
                req_node = _make(
                    workspace_id,
                    "request",
                    "Request Body",
                    parent_id=ep_node.id,
                    position_x=ep_x - 140.0,
                    position_y=80.0,
                    content_type=first_ct,
                    description=req_body.get("description"),
                )
                nodes.append(req_node)
                nodes.extend(
                    _field_nodes(
                        body_schema.get("properties", {}),
                        body_schema.get("required", []),
                        req_node.id,
                        workspace_id,
                        components,
                        ep_x - 140.0,
                        240.0,
                    )
                )

            # Responses
            for resp_offset, (status_str, resp_obj) in enumerate(
                op.get("responses", {}).items()
            ):
                try:
                    status_code: int | None = int(status_str)
                except ValueError:
                    status_code = None

                resp_node = _make(
                    workspace_id,
                    "response",
                    resp_obj.get("description") or f"Response {status_str}",
                    parent_id=ep_node.id,
                    position_x=ep_x + 140.0 + resp_offset * 220.0,
                    position_y=80.0,
                    status_code=status_code,
                    is_error=(status_code is not None and status_code >= 400),
                    description=resp_obj.get("description"),
                )
                nodes.append(resp_node)

                resp_content = resp_obj.get("content", {})
                if resp_content:
                    first_ct = next(iter(resp_content), "application/json")
                    resp_schema = _resolve_schema(
                        resp_content.get(first_ct, {}).get("schema", {}), components
                    )
                    nodes.extend(
                        _field_nodes(
                            resp_schema.get("properties", {}),
                            resp_schema.get("required", []),
                            resp_node.id,
                            workspace_id,
                            components,
                            ep_x + 140.0 + resp_offset * 220.0,
                            240.0,
                        )
                    )

            ep_idx += 1

    return nodes
