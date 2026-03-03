"""
FlowTree v2 — API Requirements Tree
────────────────────────────────────
Build a tree that captures the full specification of an API:
  API (root)  →  ENDPOINT  →  REQUEST / RESPONSE / STEP
                              FIELD (fields inside req/resp)
  MODEL nodes (siblings of ENDPOINT under API root)  →  reusable $ref schemas

Export to:
  tree.to_openapi()      →  OpenAPI 3.0 spec dict  (dump with yaml or json)
  tree.to_json_schema()  →  JSON Schema draft-07 for a model or request body
  tree.to_agent_prompt() →  structured Markdown prompt for a coding agent

Execute:
  tree.run(initial)      →  runs STEP nodes top-down, shares ExecutionContext
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


# ── NodeType ───────────────────────────────────────────────────────

class NodeType(Enum):
    API      = "api"       # root — the entire API system
    ENDPOINT = "endpoint"  # one HTTP route  (child of API)
    REQUEST  = "request"   # request body    (child of ENDPOINT)
    RESPONSE = "response"  # one HTTP status (child of ENDPOINT)
    FIELD    = "field"     # one schema field (child of REQUEST / RESPONSE / MODEL)
    MODEL    = "model"     # reusable schema  (child of API, becomes $ref)
    STEP     = "step"      # runnable pipeline stage (child of ENDPOINT)


# ── FieldConstraints ───────────────────────────────────────────────

@dataclass
class FieldConstraints:
    """JSON Schema constraint keywords for a FIELD node."""
    min_length:   int | None = None
    max_length:   int | None = None
    pattern:      str        = ""
    minimum:      float | None = None
    maximum:      float | None = None
    min_items:    int | None = None   # array only
    max_items:    int | None = None   # array only
    unique_items: bool       = False
    enum_values:  list       = field(default_factory=list)


# ── NodeData ───────────────────────────────────────────────────────

@dataclass
class NodeData:
    name:        str
    node_type:   NodeType
    description: str       = ""
    tags:        list[str] = field(default_factory=list)

    # ── API root ──────────────────────────────────────────────────
    title:               str = ""
    version:             str = "1.0.0"
    base_url:            str = "http://localhost:8000"
    tech_stack:          str = ""    # e.g. "FastAPI + SQLAlchemy async + PostgreSQL"
    architecture_notes:  str = ""
    auth_scheme:         str = ""    # e.g. "Bearer JWT"

    # ── ENDPOINT ─────────────────────────────────────────────────
    method:        str        = "GET"
    path:          str        = "/"
    summary:       str        = ""
    operation_id:  str        = ""
    deprecated:    bool       = False
    query_params:  list[dict] = field(default_factory=list)
    service_method: str       = ""   # e.g. "user_service.create_user()"
    database_query: str       = ""   # primary ORM / SQL call
    conditions:    list[str]  = field(default_factory=list)  # business rules
    is_async:      bool       = True

    # ── REQUEST / RESPONSE ────────────────────────────────────────
    content_type:     str        = "application/json"
    model_ref:        str        = ""    # → $ref: '#/components/schemas/<model_ref>'
    example:          dict       = field(default_factory=dict)
    validation_rules: list[str]  = field(default_factory=list)
    status_code:      int        = 200
    is_error:         bool       = False
    error_type:       str        = ""

    # ── FIELD ─────────────────────────────────────────────────────
    field_type:   str              = "string"  # string|integer|number|boolean|array|object
    field_format: str              = ""        # email|uuid|date-time|uri|int32|…
    required:     bool             = True
    nullable:     bool             = False
    read_only:    bool             = False
    write_only:   bool             = False
    default:      Any              = None
    items_type:   str              = ""        # array of primitives
    items_ref:    str              = ""        # array of $ref objects
    object_ref:   str              = ""        # object that is a $ref
    constraints:  FieldConstraints = field(default_factory=FieldConstraints)
    field_example: Any             = None

    # ── MODEL ─────────────────────────────────────────────────────
    base_class: str       = ""     # "BaseModel" (Pydantic) | "Base" (SQLAlchemy)
    orm_table:  str       = ""
    indexes:    list[str] = field(default_factory=list)

    # ── STEP (execution) ─────────────────────────────────────────
    language:   str       = "python"
    code:       str       = ""
    input_keys: list[str] = field(default_factory=list)
    output_key: str       = ""

    def __str__(self) -> str:
        if self.node_type == NodeType.API:
            return f"{self.title or self.name}  v{self.version}"
        if self.node_type == NodeType.ENDPOINT:
            return f"{self.method}  {self.path}"
        if self.node_type == NodeType.RESPONSE:
            return f"{self.status_code}  {self.description}"
        if self.node_type == NodeType.FIELD:
            fmt = f"({self.field_format})" if self.field_format else ""
            req = "*" if self.required else "?"
            return f"{self.name}: {self.field_type}{fmt}{req}"
        return self.name


# ── ExecutionResult ────────────────────────────────────────────────

@dataclass
class ExecutionResult:
    node_name:   str
    status:      str        # "success" | "error" | "skipped"
    inputs:      dict
    output:      Any   = None
    error:       str   = ""
    duration_ms: float = 0.0

    def __str__(self) -> str:
        icon  = {"success": "✓", "error": "✗", "skipped": "○"}.get(self.status, "?")
        lines = [f"  {icon} [{self.status.upper()}] {self.node_name}  ({self.duration_ms:.1f}ms)"]
        if self.inputs:
            lines.append(f"      inputs  → {self.inputs}")
        if self.output is not None:
            lines.append(f"      output  → {self.output}")
        if self.error:
            lines.append(f"      error   → {self.error}")
        return "\n".join(lines)


# ── ExecutionContext ───────────────────────────────────────────────

class ExecutionContext:
    """Shared data store that flows through STEP nodes during tree.run()."""

    def __init__(self, initial: dict | None = None):
        self.store:   dict                  = initial.copy() if initial else {}
        self.results: list[ExecutionResult] = []

    def get(self, key: str, default=None):
        return self.store.get(key, default)

    def set(self, key: str, value: Any):
        self.store[key] = value

    def summary(self):
        total   = len(self.results)
        success = sum(1 for r in self.results if r.status == "success")
        errors  = sum(1 for r in self.results if r.status == "error")
        print(f"\n── Execution Summary ({'✓' * success}{'✗' * errors}) ──")
        for r in self.results:
            print(r)
        print(f"\n  {success}/{total} steps ran  |  context keys: {list(self.store.keys())}")


# ── Node ───────────────────────────────────────────────────────────

class Node:
    def __init__(self, data: NodeData):
        self.data    = data
        self.childs: list[Node] = []

    def execute(self, ctx: ExecutionContext) -> ExecutionResult:
        """Run code for STEP nodes only. All declarative node types are skipped."""
        if self.data.node_type != NodeType.STEP or not self.data.code:
            return ExecutionResult(node_name=self.data.name, status="skipped", inputs={})

        inputs    = {k: ctx.get(k) for k in self.data.input_keys}
        namespace: dict = {"inputs": inputs, "output": None}
        start     = time.perf_counter()
        try:
            exec(self.data.code, namespace)  # noqa: S102
            duration = (time.perf_counter() - start) * 1000
            result = ExecutionResult(
                node_name=self.data.name, status="success",
                inputs=inputs, output=namespace.get("output"), duration_ms=duration,
            )
            if self.data.output_key and namespace.get("output") is not None:
                ctx.set(self.data.output_key, namespace["output"])
        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            result = ExecutionResult(
                node_name=self.data.name, status="error",
                inputs=inputs, error=str(exc), duration_ms=duration,
            )
        ctx.results.append(result)
        return result


# ── Tree ───────────────────────────────────────────────────────────

class Tree:

    def __init__(self):
        self.root: Node | None = None

    # ── construction ──────────────────────────────────────────────

    def set_root(self, data: NodeData):
        self.root = Node(data)

    def insert(self, parent_name: str, child_data: NodeData) -> None:
        parent = self._find(self.root, parent_name)
        if parent:
            parent.childs.append(Node(child_data))
        else:
            print(f"Parent '{parent_name}' not found.")

    def _find(self, node: Node | None, name: str) -> Node | None:
        if node is None:
            return None
        if node.data.name == name:
            return node
        for child in node.childs:
            result = self._find(child, name)
            if result:
                return result
        return None

    # ── execution ─────────────────────────────────────────────────

    def run(self, initial: dict | None = None) -> ExecutionContext:
        ctx = ExecutionContext(initial)
        if self.root is None:
            return ctx
        print(f"\n── Running: {self.root.data} ──")
        self._run_node(self.root, ctx)
        ctx.summary()
        return ctx

    def run_node(self, name: str, ctx: ExecutionContext | None = None) -> ExecutionResult | None:
        node = self._find(self.root, name)
        if node is None:
            print(f"Node '{name}' not found.")
            return None
        ctx = ctx or ExecutionContext()
        result = node.execute(ctx)
        print(result)
        return result

    def _run_node(self, node: Node, ctx: ExecutionContext):
        node.execute(ctx)
        for child in node.childs:
            self._run_node(child, ctx)

    # ── print ─────────────────────────────────────────────────────

    def print_tree(self, node: Node | None = None, level: int = 0):
        if node is None:
            node = self.root
        if node is None:
            return
        indent = "  " * level
        TAG = {
            NodeType.API:      "[API]     ",
            NodeType.ENDPOINT: f"[{node.data.method:<6}]  ",
            NodeType.REQUEST:  "[REQ]     ",
            NodeType.RESPONSE: f"[{node.data.status_code}]    ",
            NodeType.FIELD:    "[field]   ",
            NodeType.MODEL:    "[MODEL]   ",
            NodeType.STEP:     "[STEP]    ",
        }
        print(f"{indent}{TAG[node.data.node_type]}{node.data}")
        if node.data.description and node.data.node_type not in (NodeType.FIELD,):
            print(f"{indent}             → {node.data.description}")
        if node.data.output_key:
            print(f"{indent}             outputs → ctx['{node.data.output_key}']")
        for child in node.childs:
            self.print_tree(child, level + 1)

    # ── visualize ─────────────────────────────────────────────────

    COLOR = {
        NodeType.API:      "#1A1A2E",
        NodeType.ENDPOINT: "#E07B39",
        NodeType.REQUEST:  "#2E86AB",
        NodeType.RESPONSE: "#27AE60",
        NodeType.FIELD:    "#6C757D",
        NodeType.MODEL:    "#9B59B6",
        NodeType.STEP:     "#7B5EA7",
    }
    ERROR_COLOR = "#E74C3C"

    def _build_graph(self, node: Node, graph: nx.DiGraph, labels: dict):
        label = str(node.data)
        labels[id(node)] = label
        for child in node.childs:
            graph.add_edge(id(node), id(child))
            self._build_graph(child, graph, labels)

    def _collect_meta(self, node: Node, type_map: dict, color_map: dict):
        nid = id(node)
        type_map[nid] = node.data.node_type
        color_map[nid] = (
            self.ERROR_COLOR
            if node.data.node_type == NodeType.RESPONSE and node.data.is_error
            else self.COLOR[node.data.node_type]
        )
        for child in node.childs:
            self._collect_meta(child, type_map, color_map)

    def _hierarchy_pos(self, graph, root, width=1.0, vert_gap=1.5, x=0, y=0, pos=None):
        if pos is None:
            pos = {}
        pos[root] = (x, y)
        children = list(graph.successors(root))
        if children:
            dx     = width / len(children)
            next_x = x - width / 2 + dx / 2
            for child in children:
                self._hierarchy_pos(graph, child, width=dx, vert_gap=vert_gap,
                                    x=next_x, y=y - vert_gap, pos=pos)
                next_x += dx
        return pos

    def visualize(self):
        if self.root is None:
            return
        graph     = nx.DiGraph()
        labels    = {}
        type_map  = {}
        color_map = {}

        graph.add_node(id(self.root))
        labels[id(self.root)] = str(self.root.data)
        self._build_graph(self.root, graph, labels)
        self._collect_meta(self.root, type_map, color_map)

        node_colors = [color_map[n] for n in graph.nodes()]
        pos         = self._hierarchy_pos(graph, id(self.root))

        plt.figure(figsize=(16, 9))
        nx.draw(
            graph, pos,
            labels=labels,
            node_color=node_colors,
            node_size=2400,
            font_color="white",
            font_size=7,
            font_weight="bold",
            arrows=False,
            edge_color="#aaaaaa",
            width=1.5,
        )
        legend_items = [
            mpatches.Patch(color=c, label=t.value)
            for t, c in self.COLOR.items()
        ] + [mpatches.Patch(color=self.ERROR_COLOR, label="error response")]
        plt.legend(handles=legend_items, loc="upper right", fontsize=9)
        plt.title(f"FlowTree  —  {self.root.data}", fontsize=13)
        plt.show()

    # ── export: OpenAPI 3.0 ───────────────────────────────────────

    def to_openapi(self) -> dict:
        """Return an OpenAPI 3.0.3 spec as a dict. Dump with yaml.dump() or json.dumps()."""
        if self.root is None:
            return {}
        api = self.root.data
        spec: dict = {
            "openapi": "3.0.3",
            "info": {
                "title":       api.title or api.name,
                "description": api.description,
                "version":     api.version,
            },
            "servers":    [{"url": api.base_url}],
            "paths":      {},
            "components": {"schemas": {}},
        }
        if api.auth_scheme:
            spec["info"]["x-auth-scheme"] = api.auth_scheme

        for child in self.root.childs:
            if child.data.node_type == NodeType.MODEL:
                spec["components"]["schemas"][child.data.name] = self._oa_model(child)
            elif child.data.node_type == NodeType.ENDPOINT:
                path   = child.data.path
                method = child.data.method.lower()
                spec["paths"].setdefault(path, {})[method] = self._oa_operation(child)

        return spec

    def _oa_operation(self, ep: Node) -> dict:
        d = ep.data
        op: dict = {
            "summary":     d.summary or d.description,
            "description": d.description,
            "operationId": d.operation_id or d.name.replace(" ", "_").lower(),
            "tags":        d.tags,
        }
        if d.deprecated:
            op["deprecated"] = True
        if d.query_params:
            op["parameters"] = [
                {"name": p["name"], "in": "query",
                 "required": p.get("required", False),
                 "description": p.get("description", ""),
                 "schema": {"type": p.get("type", "string")}}
                for p in d.query_params
            ]
        responses: dict = {}
        for child in ep.childs:
            if child.data.node_type == NodeType.REQUEST:
                op["requestBody"] = self._oa_request_body(child)
            elif child.data.node_type == NodeType.RESPONSE:
                responses[str(child.data.status_code)] = self._oa_response(child)
        op["responses"] = responses or {"200": {"description": "OK"}}
        return op

    def _oa_request_body(self, req: Node) -> dict:
        d = req.data
        schema = self._oa_schema_from_children(req)
        body: dict = {
            "required": d.required,
            "content":  {d.content_type: {"schema": schema}},
        }
        if d.example:
            body["content"][d.content_type]["example"] = d.example
        return body

    def _oa_response(self, resp: Node) -> dict:
        d = resp.data
        out: dict = {"description": d.description or str(d.status_code)}
        schema = self._oa_schema_from_children(resp)
        if schema:
            out["content"] = {d.content_type: {"schema": schema}}
            if d.example:
                out["content"][d.content_type]["example"] = d.example
        return out

    def _oa_schema_from_children(self, node: Node) -> dict:
        """Build schema for REQUEST / RESPONSE / MODEL from its FIELD children."""
        if node.data.model_ref:
            return {"$ref": f"#/components/schemas/{node.data.model_ref}"}
        fields = [c for c in node.childs if c.data.node_type == NodeType.FIELD]
        if not fields:
            return {}
        props:    dict      = {}
        required: list[str] = []
        for f in fields:
            props[f.data.name] = self._oa_field(f)
            if f.data.required and not f.data.read_only:
                required.append(f.data.name)
        schema: dict = {"type": "object", "properties": props}
        if required:
            schema["required"] = required
        return schema

    def _oa_field(self, f: Node) -> dict:
        d = f.data
        if d.object_ref:
            s: dict = {"$ref": f"#/components/schemas/{d.object_ref}"}
            return {"nullable": True, "allOf": [s]} if d.nullable else s

        s = {"type": d.field_type}
        if d.field_format:  s["format"]      = d.field_format
        if d.nullable:      s["nullable"]     = True
        if d.read_only:     s["readOnly"]     = True
        if d.write_only:    s["writeOnly"]    = True
        if d.description:   s["description"]  = d.description
        if d.default is not None:      s["default"]  = d.default
        if d.field_example is not None: s["example"] = d.field_example

        c = d.constraints
        if c.min_length  is not None: s["minLength"]  = c.min_length
        if c.max_length  is not None: s["maxLength"]  = c.max_length
        if c.pattern:                  s["pattern"]    = c.pattern
        if c.minimum     is not None: s["minimum"]    = c.minimum
        if c.maximum     is not None: s["maximum"]    = c.maximum
        if c.enum_values:              s["enum"]       = c.enum_values

        if d.field_type == "array":
            if d.items_ref:   s["items"] = {"$ref": f"#/components/schemas/{d.items_ref}"}
            elif d.items_type: s["items"] = {"type": d.items_type}
            if c.min_items  is not None: s["minItems"]  = c.min_items
            if c.max_items  is not None: s["maxItems"]  = c.max_items
            if c.unique_items:            s["uniqueItems"] = True

        if d.field_type == "object" and f.childs:
            nested_props: dict      = {}
            nested_req:   list[str] = []
            for child in f.childs:
                if child.data.node_type == NodeType.FIELD:
                    nested_props[child.data.name] = self._oa_field(child)
                    if child.data.required:
                        nested_req.append(child.data.name)
            s["properties"] = nested_props
            if nested_req:
                s["required"] = nested_req

        return s

    def _oa_model(self, model: Node) -> dict:
        schema = self._oa_schema_from_children(model)
        if model.data.description:
            schema["description"] = model.data.description
        if model.data.orm_table:
            schema["x-orm-table"] = model.data.orm_table
        return schema

    # ── export: JSON Schema ───────────────────────────────────────

    def to_json_schema(self, model_name: str | None = None) -> dict:
        """Return JSON Schema draft-07 for a named model or the first request body."""
        target: Node | None = None
        if model_name:
            target = self._find(self.root, model_name)
        else:
            for child in (self.root.childs if self.root else []):
                if child.data.node_type == NodeType.ENDPOINT:
                    for grandchild in child.childs:
                        if grandchild.data.node_type == NodeType.REQUEST:
                            target = grandchild
                            break
                if target:
                    break

        if target is None:
            return {}

        schema = self._oa_schema_from_children(target)
        schema["$schema"]     = "https://json-schema.org/draft-07/schema#"
        schema["title"]       = target.data.name
        if target.data.description:
            schema["description"] = target.data.description
        return schema

    # ── export: agent prompt ──────────────────────────────────────

    def to_agent_prompt(self) -> str:
        """Return a structured Markdown prompt for a coding agent."""
        if self.root is None:
            return ""
        api   = self.root.data
        lines = []

        lines += [
            f"# Implementation Spec: {api.title or api.name}", "",
            "> You are a coding agent. Generate **complete, production-ready code** from "
            "this spec. Do not omit error handling, validation, or tests.", "",
        ]
        if api.tech_stack:          lines.append(f"**Tech Stack**: {api.tech_stack}")
        if api.architecture_notes:  lines.append(f"**Architecture**: {api.architecture_notes}")
        if api.auth_scheme:         lines.append(f"**Auth**: {api.auth_scheme}")
        lines += [f"**Base URL**: {api.base_url}", ""]

        # Models section
        models = [c for c in self.root.childs if c.data.node_type == NodeType.MODEL]
        if models:
            lines += ["---", "## Data Models", ""]
            for m in models:
                lines += self._ap_model(m)

        # Endpoints section
        endpoints = [c for c in self.root.childs if c.data.node_type == NodeType.ENDPOINT]
        if endpoints:
            lines += ["---", "## Endpoints", ""]
            for ep in endpoints:
                lines += self._ap_endpoint(ep)

        return "\n".join(lines)

    def _ap_model(self, model: Node) -> list[str]:
        d     = model.data
        lines = [f"### Model: `{d.name}`"]
        if d.description:    lines.append(f"> {d.description}")
        if d.base_class:     lines.append(f"- Base class: `{d.base_class}`")
        if d.orm_table:      lines.append(f"- DB Table: `{d.orm_table}`")
        if d.indexes:        lines.append(f"- Indexes: {', '.join(f'`{i}`' for i in d.indexes)}")
        lines.append("")
        fields = [c for c in model.childs if c.data.node_type == NodeType.FIELD]
        if fields:
            lines += self._ap_field_table(fields)
        lines.append("")
        return lines

    def _ap_endpoint(self, ep: Node) -> list[str]:
        d     = ep.data
        lines = [f"### `{d.method} {d.path}`  —  {d.summary or d.description}", ""]
        if d.operation_id:  lines.append(f"- **operationId**: `{d.operation_id}`")
        if d.tags:          lines.append(f"- **Tags**: {', '.join(d.tags)}")
        if d.is_async:      lines.append("- **Async**: Yes")
        if d.service_method: lines.append(f"- **Service**: `{d.service_method}`")
        if d.database_query: lines.append(f"- **DB query**: `{d.database_query}`")
        if d.conditions:
            lines.append("- **Business rules**:")
            for rule in d.conditions:
                lines.append(f"  - {rule}")
        if d.query_params:
            lines += ["", "**Query parameters**:"]
            for p in d.query_params:
                req = "required" if p.get("required") else "optional"
                lines.append(f"- `{p['name']}` ({p.get('type','string')}, {req}): {p.get('description','')}")
        lines.append("")

        for child in ep.childs:
            if child.data.node_type == NodeType.REQUEST:
                lines += self._ap_request(child)

        responses = [c for c in ep.childs if c.data.node_type == NodeType.RESPONSE]
        if responses:
            lines += ["**Responses**:", ""]
            for r in sorted(responses, key=lambda n: n.data.status_code):
                lines += self._ap_response(r)

        steps = [c for c in ep.childs if c.data.node_type == NodeType.STEP]
        if steps:
            lines += ["**Processing steps**:", ""]
            for i, step in enumerate(steps, 1):
                lines.append(f"{i}. **{step.data.name}** — {step.data.description}")
                if step.data.code:
                    lines += [f"   ```{step.data.language}", f"   {step.data.code.strip()}", "   ```"]
            lines.append("")

        lines += ["---", ""]
        return lines

    def _ap_request(self, req: Node) -> list[str]:
        d     = req.data
        lines = [f"**Request body** (`{d.content_type}`):", ""]
        if d.model_ref:
            lines.append(f"Schema: → `{d.model_ref}` (see Models section)")
        else:
            fields = [c for c in req.childs if c.data.node_type == NodeType.FIELD]
            if fields:
                lines += self._ap_field_table(fields)
        if d.validation_rules:
            lines += ["", "Validation rules:"] + [f"- {r}" for r in d.validation_rules]
        if d.example:
            lines += ["", "Example:", f"```json\n{json.dumps(d.example, indent=2)}\n```"]
        lines.append("")
        return lines

    def _ap_response(self, resp: Node) -> list[str]:
        d    = resp.data
        icon = "❌" if d.is_error else "✅"
        lines = [f"{icon} **{d.status_code}** — {d.description}"]
        if d.error_type:
            lines.append(f"   Error type: `{d.error_type}`")
        if d.model_ref:
            lines.append(f"   Schema: → `{d.model_ref}`")
        else:
            fields = [c for c in resp.childs if c.data.node_type == NodeType.FIELD]
            if fields:
                lines += self._ap_field_table(fields)
        if d.example:
            lines += [f"```json\n{json.dumps(d.example, indent=2)}\n```"]
        lines.append("")
        return lines

    def _ap_field_table(self, fields: list[Node]) -> list[str]:
        header = ["| Field | Type | Req | Format / Constraints | Description |",
                  "|-------|------|:---:|----------------------|-------------|"]
        rows = []
        for f in fields:
            d  = f.data
            c  = d.constraints
            req = "✓" if d.required else ""

            type_str = d.field_type
            if d.items_ref:         type_str = f"array[{d.items_ref}]"
            elif d.items_type:      type_str = f"array[{d.items_type}]"
            elif d.field_format:    type_str = f"{d.field_type}({d.field_format})"

            parts = []
            if d.read_only:               parts.append("readOnly")
            if d.write_only:              parts.append("writeOnly")
            if c.min_length is not None:  parts.append(f"minLen={c.min_length}")
            if c.max_length is not None:  parts.append(f"maxLen={c.max_length}")
            if c.pattern:                 parts.append(f"pattern=`{c.pattern}`")
            if c.minimum is not None:     parts.append(f"min={c.minimum}")
            if c.maximum is not None:     parts.append(f"max={c.maximum}")
            if c.enum_values:             parts.append(f"enum={c.enum_values}")

            rows.append(
                f"| `{d.name}` | {type_str} | {req} | {', '.join(parts)} | {d.description} |"
            )
        return header + rows


# ── Example: POST /users/register ─────────────────────────────────

if __name__ == "__main__":

    tree = Tree()

    # ── API root ──────────────────────────────────────────────────
    tree.set_root(NodeData(
        name              = "User Management API",
        node_type         = NodeType.API,
        title             = "User Management API",
        description       = "Handles user registration, auth, and profile management",
        version           = "1.0.0",
        base_url          = "https://api.example.com",
        tech_stack        = "FastAPI + SQLAlchemy async + PostgreSQL + Pydantic v2",
        architecture_notes= "Repository pattern. Separate service layer from route handlers.",
        auth_scheme       = "Bearer JWT",
    ))

    # ── Reusable models (children of API root) ────────────────────
    tree.insert("User Management API", NodeData(
        name        = "UserResponse",
        node_type   = NodeType.MODEL,
        description = "Public user object returned by endpoints",
        base_class  = "BaseModel",
        orm_table   = "users",
        indexes     = ["email", "username"],
    ))
    tree.insert("UserResponse", NodeData(name="user_id",    node_type=NodeType.FIELD,
        field_type="string", field_format="uuid", read_only=True, required=True,
        description="Unique user identifier"))
    tree.insert("UserResponse", NodeData(name="email",      node_type=NodeType.FIELD,
        field_type="string", field_format="email", required=True, description="User email"))
    tree.insert("UserResponse", NodeData(name="username",   node_type=NodeType.FIELD,
        field_type="string", required=True, description="Display name"))
    tree.insert("UserResponse", NodeData(name="created_at", node_type=NodeType.FIELD,
        field_type="string", field_format="date-time", read_only=True, required=True,
        description="Account creation timestamp"))

    tree.insert("User Management API", NodeData(
        name        = "ErrorDetail",
        node_type   = NodeType.MODEL,
        description = "Standard error response body",
        base_class  = "BaseModel",
    ))
    tree.insert("ErrorDetail", NodeData(name="code",    node_type=NodeType.FIELD,
        field_type="string", required=True, description="Machine-readable error code",
        constraints=FieldConstraints(enum_values=["VALIDATION_ERROR", "CONFLICT", "NOT_FOUND", "UNAUTHORIZED"])))
    tree.insert("ErrorDetail", NodeData(name="message", node_type=NodeType.FIELD,
        field_type="string", required=True, description="Human-readable error message"))

    # ── ENDPOINT: POST /users/register ────────────────────────────
    tree.insert("User Management API", NodeData(
        name          = "Register User",
        node_type     = NodeType.ENDPOINT,
        method        = "POST",
        path          = "/users/register",
        summary       = "Create a new user account",
        description   = "Validates input, hashes password, and persists a new user.",
        operation_id  = "registerUser",
        tags          = ["users", "auth"],
        is_async      = True,
        service_method= "user_service.create_user(body)",
        database_query= "INSERT INTO users (email, username, password_hash) VALUES (...)",
        conditions    = [
            "email must be unique across all users",
            "username must be unique and URL-safe",
        ],
    ))

    # REQUEST body
    tree.insert("Register User", NodeData(
        name             = "RegisterRequest",
        node_type        = NodeType.REQUEST,
        content_type     = "application/json",
        validation_rules = [
            "email must be a valid RFC 5322 address",
            "password must contain at least one uppercase letter and one digit",
        ],
        example          = {
            "email":    "alice@example.com",
            "username": "alice",
            "password": "S3cureP@ss",
        },
    ))
    tree.insert("RegisterRequest", NodeData(name="email",    node_type=NodeType.FIELD,
        field_type="string", field_format="email", required=True,
        description="User's email address",
        constraints=FieldConstraints(max_length=254),
        field_example="alice@example.com"))
    tree.insert("RegisterRequest", NodeData(name="username", node_type=NodeType.FIELD,
        field_type="string", required=True,
        description="Unique display name (alphanumeric + underscore)",
        constraints=FieldConstraints(min_length=3, max_length=30, pattern="^[a-zA-Z0-9_]+$"),
        field_example="alice"))
    tree.insert("RegisterRequest", NodeData(name="password", node_type=NodeType.FIELD,
        field_type="string", write_only=True, required=True,
        description="Plain-text password (hashed before storage)",
        constraints=FieldConstraints(min_length=8, max_length=128),
        field_example="S3cureP@ss"))

    # RESPONSE: 201 Created  (references UserResponse model)
    tree.insert("Register User", NodeData(
        name        = "201 Created",
        node_type   = NodeType.RESPONSE,
        status_code = 201,
        description = "User created successfully",
        model_ref   = "UserResponse",
        example     = {"user_id": "a1b2c3d4-...", "email": "alice@example.com",
                        "username": "alice", "created_at": "2026-01-01T00:00:00Z"},
    ))

    # RESPONSE: 409 Conflict
    tree.insert("Register User", NodeData(
        name        = "409 Conflict",
        node_type   = NodeType.RESPONSE,
        status_code = 409,
        description = "Email or username already exists",
        is_error    = True,
        error_type  = "CONFLICT",
        model_ref   = "ErrorDetail",
        example     = {"code": "CONFLICT", "message": "Email already registered"},
    ))

    # RESPONSE: 422 Validation Error
    tree.insert("Register User", NodeData(
        name        = "422 Unprocessable",
        node_type   = NodeType.RESPONSE,
        status_code = 422,
        description = "Request body failed validation",
        is_error    = True,
        error_type  = "VALIDATION_ERROR",
        model_ref   = "ErrorDetail",
        example     = {"code": "VALIDATION_ERROR", "message": "email: invalid format"},
    ))

    # STEPs — pipeline stages (also runnable via tree.run())
    tree.insert("Register User", NodeData(
        name        = "Validate Input",
        node_type   = NodeType.STEP,
        description = "Check email format and password strength",
        input_keys  = ["body"],
        output_key  = "validated_body",
        code        = """
import re
body = inputs["body"]
if not re.match(r"[^@]+@[^@]+\\.[^@]+", body.get("email", "")):
    raise ValueError("Invalid email format")
if len(body.get("password", "")) < 8:
    raise ValueError("Password too short")
output = body
""",
    ))

    tree.insert("Register User", NodeData(
        name        = "Hash & Save",
        node_type   = NodeType.STEP,
        description = "Hash password and persist user to DB",
        input_keys  = ["validated_body"],
        output_key  = "response",
        code        = """
import hashlib, uuid
body    = inputs["validated_body"]
pw_hash = hashlib.sha256(body["password"].encode()).hexdigest()
user_id = str(uuid.uuid4())
print(f"  [DB] INSERT user  id={user_id}  email={body['email']}")
output  = {"user_id": user_id, "email": body["email"],
            "username": body["username"], "created_at": "2026-01-01T00:00:00Z"}
""",
    ))

    # ── print tree ────────────────────────────────────────────────
    print("── Tree Structure ────────────────────────────────────────")
    tree.print_tree()

    # ── run pipeline ──────────────────────────────────────────────
    ctx = tree.run(initial={"body": {
        "email": "alice@example.com", "username": "alice", "password": "S3cureP@ss"
    }})
    print(f"\n  API response: {ctx.get('response')}")

    # ── export: OpenAPI spec ──────────────────────────────────────
    spec = tree.to_openapi()
    print("\n── OpenAPI 3.0 Spec (JSON) ────────────────────────────────")
    print(json.dumps(spec, indent=2))

    # ── export: JSON Schema ───────────────────────────────────────
    print("\n── JSON Schema: RegisterRequest ───────────────────────────")
    print(json.dumps(tree.to_json_schema(), indent=2))

    # ── export: agent prompt ──────────────────────────────────────
    print("\n── Agent Prompt ───────────────────────────────────────────")
    print(tree.to_agent_prompt())

    # ── visualize ─────────────────────────────────────────────────
    tree.visualize()
