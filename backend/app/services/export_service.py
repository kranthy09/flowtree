"""Export service: port of main.py Tree export methods to work with FlowNode ORM objects."""

import json
import uuid

import yaml
from sqlalchemy import inspect as sa_inspect

from app.models.node import FlowNode


# ── tree builder ───────────────────────────────────────────────────────────


def _node_to_dict(node: FlowNode) -> dict:
    """Convert FlowNode ORM to a plain dict for export processing.

    Uses sa_inspect to read only column values (avoids MissingGreenlet from
    lazy relationship access).  Normalises field names to match main.py NodeData:
      - nullable_field  → nullable
      - default_value   → default
    """
    mapper = sa_inspect(FlowNode)
    data: dict = {col.key: getattr(node, col.key) for col in mapper.columns}
    data["nullable"] = data.pop("nullable_field")
    data["default"] = data.pop("default_value")
    data["children"] = []
    return data


def build_tree(nodes: list[FlowNode]) -> dict | None:
    """Build a nested dict tree from a flat list of FlowNode ORM objects.

    Returns the API root node dict with ``children`` populated recursively,
    or None if the list is empty.
    """
    if not nodes:
        return None

    dicts: dict[uuid.UUID, dict] = {n.id: _node_to_dict(n) for n in nodes}
    root: dict | None = None

    for nd in dicts.values():
        parent_id = nd["parent_id"]
        if parent_id is None:
            if nd["node_type"] == "api" and root is None:
                root = nd
        elif parent_id in dicts:
            dicts[parent_id]["children"].append(nd)

    if root is None:
        # Fallback: first node without a parent
        root = next((nd for nd in dicts.values() if nd["parent_id"] is None), None)

    return root


# ── OpenAPI 3.0 export ─────────────────────────────────────────────────────


def to_openapi(nodes: list[FlowNode], output_format: str = "json") -> str:
    """Return an OpenAPI 3.0.3 spec serialised to JSON or YAML."""
    root = build_tree(nodes)
    if root is None:
        return "{}"

    spec: dict = {
        "openapi": "3.0.3",
        "info": {
            "title":       root.get("title") or root["name"],
            "description": root.get("description") or "",
            "version":     root.get("version") or "1.0.0",
        },
        "servers":    [{"url": root.get("base_url") or "http://localhost:8000"}],
        "paths":      {},
        "components": {"schemas": {}},
    }
    if root.get("auth_scheme"):
        spec["info"]["x-auth-scheme"] = root["auth_scheme"]

    for child in root["children"]:
        if child["node_type"] == "model":
            spec["components"]["schemas"][child["name"]] = _oa_model(child)
        elif child["node_type"] == "endpoint":
            path   = child.get("path") or "/"
            method = (child.get("method") or "GET").lower()
            spec["paths"].setdefault(path, {})[method] = _oa_operation(child)

    if output_format == "yaml":
        return yaml.dump(spec, allow_unicode=True, sort_keys=False)
    return json.dumps(spec, indent=2, default=str)


def _oa_operation(ep: dict) -> dict:
    op: dict = {
        "summary":     ep.get("summary") or ep.get("description") or "",
        "description": ep.get("description") or "",
        "operationId": ep.get("operation_id") or ep["name"].replace(" ", "_").lower(),
        "tags":        ep.get("tags") or [],
    }
    if ep.get("deprecated"):
        op["deprecated"] = True
    qp = ep.get("query_params") or []
    if qp:
        op["parameters"] = [
            {
                "name":        p["name"],
                "in":          "query",
                "required":    p.get("required", False),
                "description": p.get("description", ""),
                "schema":      {"type": p.get("type", "string")},
            }
            for p in qp
        ]
    responses: dict = {}
    for child in ep["children"]:
        if child["node_type"] == "request":
            op["requestBody"] = _oa_request_body(child)
        elif child["node_type"] == "response":
            sc = child.get("status_code") or 200
            responses[str(sc)] = _oa_response(child)
    op["responses"] = responses or {"200": {"description": "OK"}}
    return op


def _oa_request_body(req: dict) -> dict:
    schema = _oa_schema_from_children(req)
    ct = req.get("content_type") or "application/json"
    body: dict = {
        "required": bool(req.get("required", True)),
        "content":  {ct: {"schema": schema}},
    }
    if req.get("example"):
        body["content"][ct]["example"] = req["example"]
    return body


def _oa_response(resp: dict) -> dict:
    sc  = resp.get("status_code") or 200
    out: dict = {"description": resp.get("description") or str(sc)}
    schema = _oa_schema_from_children(resp)
    if schema:
        ct = resp.get("content_type") or "application/json"
        out["content"] = {ct: {"schema": schema}}
        if resp.get("example"):
            out["content"][ct]["example"] = resp["example"]
    return out


def _oa_schema_from_children(node: dict) -> dict:
    """Build a JSON Schema object from FIELD children, or a $ref if model_ref is set."""
    if node.get("model_ref"):
        return {"$ref": f"#/components/schemas/{node['model_ref']}"}
    fields = [c for c in node["children"] if c["node_type"] == "field"]
    if not fields:
        return {}
    props:    dict      = {}
    required: list[str] = []
    for f in fields:
        props[f["name"]] = _oa_field(f)
        if f.get("required", True) and not f.get("read_only", False):
            required.append(f["name"])
    schema: dict = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return schema


def _oa_field(f: dict) -> dict:
    if f.get("object_ref"):
        ref: dict = {"$ref": f"#/components/schemas/{f['object_ref']}"}
        return {"nullable": True, "allOf": [ref]} if f.get("nullable") else ref

    ft = f.get("field_type") or "string"
    s: dict = {"type": ft}
    if f.get("field_format"):          s["format"]      = f["field_format"]
    if f.get("nullable"):              s["nullable"]     = True
    if f.get("read_only"):             s["readOnly"]     = True
    if f.get("write_only"):            s["writeOnly"]    = True
    if f.get("description"):           s["description"]  = f["description"]
    if f.get("default") is not None:   s["default"]      = f["default"]
    if f.get("field_example") is not None: s["example"]  = f["field_example"]

    c = f.get("constraints") or {}
    if c.get("min_length") is not None: s["minLength"]   = c["min_length"]
    if c.get("max_length") is not None: s["maxLength"]   = c["max_length"]
    if c.get("pattern"):                s["pattern"]     = c["pattern"]
    if c.get("minimum") is not None:    s["minimum"]     = c["minimum"]
    if c.get("maximum") is not None:    s["maximum"]     = c["maximum"]
    if c.get("enum_values"):            s["enum"]        = c["enum_values"]

    if ft == "array":
        if f.get("items_ref"):
            s["items"] = {"$ref": f"#/components/schemas/{f['items_ref']}"}
        elif f.get("items_type"):
            s["items"] = {"type": f["items_type"]}
        if c.get("min_items") is not None: s["minItems"]   = c["min_items"]
        if c.get("max_items") is not None: s["maxItems"]   = c["max_items"]
        if c.get("unique_items"):          s["uniqueItems"] = True

    if ft == "object" and f["children"]:
        nested_props: dict      = {}
        nested_req:   list[str] = []
        for child in f["children"]:
            if child["node_type"] == "field":
                nested_props[child["name"]] = _oa_field(child)
                if child.get("required", True):
                    nested_req.append(child["name"])
        s["properties"] = nested_props
        if nested_req:
            s["required"] = nested_req

    return s


def _oa_model(model: dict) -> dict:
    schema = _oa_schema_from_children(model)
    if model.get("description"):
        schema["description"] = model["description"]
    if model.get("orm_table"):
        schema["x-orm-table"] = model["orm_table"]
    return schema


# ── JSON Schema draft-07 export ────────────────────────────────────────────


def to_json_schema(nodes: list[FlowNode], model_name: str | None = None) -> str:
    """Return JSON Schema draft-07 for a named model or the first request body."""
    root = build_tree(nodes)
    if root is None:
        return "{}"

    target: dict | None = None
    if model_name:
        target = _find_node(root, model_name)
    else:
        for child in root["children"]:
            if child["node_type"] == "endpoint":
                for gc in child["children"]:
                    if gc["node_type"] == "request":
                        target = gc
                        break
            if target:
                break

    if target is None:
        return "{}"

    schema = _oa_schema_from_children(target)
    schema["$schema"] = "https://json-schema.org/draft-07/schema#"
    schema["title"]   = target["name"]
    if target.get("description"):
        schema["description"] = target["description"]
    return json.dumps(schema, indent=2, default=str)


def _find_node(node: dict, name: str) -> dict | None:
    if node["name"] == name:
        return node
    for child in node["children"]:
        result = _find_node(child, name)
        if result:
            return result
    return None


# ── Agent prompt export ────────────────────────────────────────────────────


def to_agent_prompt(nodes: list[FlowNode]) -> str:
    """Return a structured Markdown prompt for a coding agent."""
    root = build_tree(nodes)
    if root is None:
        return ""

    lines: list[str] = []
    lines += [
        f"# Implementation Spec: {root.get('title') or root['name']}", "",
        "> You are a coding agent. Generate **complete, production-ready code** from "
        "this spec. Do not omit error handling, validation, or tests.", "",
    ]
    if root.get("tech_stack"):         lines.append(f"**Tech Stack**: {root['tech_stack']}")
    if root.get("architecture_notes"): lines.append(f"**Architecture**: {root['architecture_notes']}")
    if root.get("auth_scheme"):        lines.append(f"**Auth**: {root['auth_scheme']}")
    lines += [f"**Base URL**: {root.get('base_url') or 'http://localhost:8000'}", ""]

    models = [c for c in root["children"] if c["node_type"] == "model"]
    if models:
        lines += ["---", "## Data Models", ""]
        for m in models:
            lines += _ap_model(m)

    endpoints = [c for c in root["children"] if c["node_type"] == "endpoint"]
    if endpoints:
        lines += ["---", "## Endpoints", ""]
        for ep in endpoints:
            lines += _ap_endpoint(ep)

    return "\n".join(lines)


def _ap_model(model: dict) -> list[str]:
    lines: list[str] = [f"### Model: `{model['name']}`"]
    if model.get("description"): lines.append(f"> {model['description']}")
    if model.get("base_class"):  lines.append(f"- Base class: `{model['base_class']}`")
    if model.get("orm_table"):   lines.append(f"- DB Table: `{model['orm_table']}`")
    idxs = model.get("indexes") or []
    if idxs:
        lines.append(f"- Indexes: {', '.join(f'`{i}`' for i in idxs)}")
    lines.append("")
    fields = [c for c in model["children"] if c["node_type"] == "field"]
    if fields:
        lines += _ap_field_table(fields)
    lines.append("")
    return lines


def _ap_endpoint(ep: dict) -> list[str]:
    method = ep.get("method") or "GET"
    path   = ep.get("path") or "/"
    lines: list[str] = [
        f"### `{method} {path}`  —  {ep.get('summary') or ep.get('description') or ''}", "",
    ]
    if ep.get("operation_id"):    lines.append(f"- **operationId**: `{ep['operation_id']}`")
    tags = ep.get("tags") or []
    if tags:                      lines.append(f"- **Tags**: {', '.join(tags)}")
    if ep.get("is_async", True):  lines.append("- **Async**: Yes")
    if ep.get("service_method"):  lines.append(f"- **Service**: `{ep['service_method']}`")
    if ep.get("database_query"):  lines.append(f"- **DB query**: `{ep['database_query']}`")
    conditions = ep.get("conditions") or []
    if conditions:
        lines.append("- **Business rules**:")
        for rule in conditions:
            lines.append(f"  - {rule}")
    qp = ep.get("query_params") or []
    if qp:
        lines += ["", "**Query parameters**:"]
        for p in qp:
            req = "required" if p.get("required") else "optional"
            lines.append(f"- `{p['name']}` ({p.get('type', 'string')}, {req}): {p.get('description', '')}")
    lines.append("")

    for child in ep["children"]:
        if child["node_type"] == "request":
            lines += _ap_request(child)

    responses = [c for c in ep["children"] if c["node_type"] == "response"]
    if responses:
        lines += ["**Responses**:", ""]
        for r in sorted(responses, key=lambda n: n.get("status_code") or 200):
            lines += _ap_response(r)

    steps = [c for c in ep["children"] if c["node_type"] == "step"]
    if steps:
        lines += ["**Processing steps**:", ""]
        for i, step in enumerate(steps, 1):
            lines.append(f"{i}. **{step['name']}** — {step.get('description') or ''}")
            if step.get("code"):
                lang = step.get("language") or "python"
                lines += [f"   ```{lang}", f"   {step['code'].strip()}", "   ```"]
        lines.append("")

    lines += ["---", ""]
    return lines


def _ap_request(req: dict) -> list[str]:
    ct = req.get("content_type") or "application/json"
    lines: list[str] = [f"**Request body** (`{ct}`):", ""]
    if req.get("model_ref"):
        lines.append(f"Schema: → `{req['model_ref']}` (see Models section)")
    else:
        fields = [c for c in req["children"] if c["node_type"] == "field"]
        if fields:
            lines += _ap_field_table(fields)
    vr = req.get("validation_rules") or []
    if vr:
        lines += ["", "Validation rules:"] + [f"- {r}" for r in vr]
    if req.get("example"):
        lines += ["", "Example:", f"```json\n{json.dumps(req['example'], indent=2)}\n```"]
    lines.append("")
    return lines


def _ap_response(resp: dict) -> list[str]:
    sc   = resp.get("status_code") or 200
    icon = "❌" if resp.get("is_error") else "✅"
    lines: list[str] = [f"{icon} **{sc}** — {resp.get('description') or str(sc)}"]
    if resp.get("error_type"):
        lines.append(f"   Error type: `{resp['error_type']}`")
    if resp.get("model_ref"):
        lines.append(f"   Schema: → `{resp['model_ref']}`")
    else:
        fields = [c for c in resp["children"] if c["node_type"] == "field"]
        if fields:
            lines += _ap_field_table(fields)
    if resp.get("example"):
        lines += [f"```json\n{json.dumps(resp['example'], indent=2)}\n```"]
    lines.append("")
    return lines


def _ap_field_table(fields: list[dict]) -> list[str]:
    header = [
        "| Field | Type | Req | Format / Constraints | Description |",
        "|-------|------|:---:|----------------------|-------------|",
    ]
    rows: list[str] = []
    for f in fields:
        c   = f.get("constraints") or {}
        req = "✓" if f.get("required", True) else ""
        ft  = f.get("field_type") or "string"

        if f.get("items_ref"):      type_str = f"array[{f['items_ref']}]"
        elif f.get("items_type"):   type_str = f"array[{f['items_type']}]"
        elif f.get("field_format"): type_str = f"{ft}({f['field_format']})"
        else:                       type_str = ft

        parts: list[str] = []
        if f.get("read_only"):                parts.append("readOnly")
        if f.get("write_only"):               parts.append("writeOnly")
        if c.get("min_length") is not None:   parts.append(f"minLen={c['min_length']}")
        if c.get("max_length") is not None:   parts.append(f"maxLen={c['max_length']}")
        if c.get("pattern"):                  parts.append(f"pattern=`{c['pattern']}`")
        if c.get("minimum") is not None:      parts.append(f"min={c['minimum']}")
        if c.get("maximum") is not None:      parts.append(f"max={c['maximum']}")
        if c.get("enum_values"):              parts.append(f"enum={c['enum_values']}")

        rows.append(
            f"| `{f['name']}` | {type_str} | {req} | {', '.join(parts)} | {f.get('description') or ''} |"
        )
    return header + rows
