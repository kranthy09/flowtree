# FlowTree — Feature Requests & Code Generation Guidelines

Each request below is a self-contained unit of work for a coding agent.
Provide the request text verbatim (or with your specifics filled in) to the agent.
All requests assume the stack and conventions in `context.md`.

---

## Guidelines for Every Request

Before generating code for any request, the agent must:

1. Read `context.md` for folder structure, layer rules, DB schema, and design system.
2. Read `features.md` for the feature specification.
3. Read existing files in the relevant layer before writing new ones.
4. Follow **single responsibility**: route → service → repository.
5. Use **async/await** for all DB and I/O operations.
6. Use **Pydantic v2** schemas (not v1 style).
7. Use **SQLAlchemy 2.0 async** (not legacy sync ORM).
8. Use **TypeScript strict mode** on frontend. No `any`.
9. Match **color and spacing tokens** from `context.md` section 7.
10. Write tests for every backend service function.

---

## R1 — Project Bootstrap

### R1.1 Docker Compose Setup

```
Context: context.md §8 (Docker services), context.md §9 (env vars)

Add Redis, Celery worker, and Flower to the existing docker-compose.yml.
The existing services are: db (postgres:16), backend (FastAPI), frontend (Next.js).

Add:
- redis: redis:7-alpine, port 6379, named volume
- worker: same Dockerfile as backend, command: celery -A app.workers.celery_app worker
- flower: mher/flower:2.0, port 5555, depends on redis and worker

Update docker-compose.dev.yml with volume mounts for hot reload.
Update .env.example with REDIS_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND.

Do not change existing service definitions.
Generate: docker-compose.yml, docker-compose.dev.yml, .env.example
```

### R1.2 Celery App Factory

```
Context: context.md §5 (Celery tasks), backend/app/config.py

Create backend/app/workers/celery_app.py:
- CeleryApp = Celery("flowtree", broker=settings.CELERY_BROKER_URL, ...)
- Configure result backend, task serializer (json), timezone (UTC).
- Export: celery_app

Create backend/app/workers/tasks.py:
- execute_pipeline(workspace_id: str, run_id: str, initial_context: dict) -> dict
  Runs all STEP nodes in DFS order. For each STEP node with code, exec() the code.
  Writes ExecutionRecord rows to DB after each node via synchronous SQLAlchemy
  (Celery workers use sync DB session, not async).
  Returns: {run_id, results: [{node_id, status, output, duration_ms}]}

- execute_single_node(node_id: str, run_id: str, input_data: dict) -> dict
  Runs one STEP node. Returns same shape as one element of the above results list.

Reference execution logic from main.py Node.execute() method.
```

### R1.3 Database Migration: Workspace + FlowNode

```
Context: context.md §4 (DB schema)

The current DB has: number_nodes, executions tables.
Do not drop existing tables. Create new tables alongside them.

Using Alembic, generate a migration that creates:
1. workspaces table (id UUID PK, name, description, created_at, updated_at)
2. flow_nodes table (full schema from context.md §4)
3. executions table update: add workspace_id UUID column, make node_id reference flow_nodes

Create SQLAlchemy models:
- backend/app/models/workspace.py → Workspace
- backend/app/models/node.py → FlowNode
- backend/app/models/execution.py → Execution (updated)

Generate: alembic migration file, three model files.
```

---

## R2 — Workspace API

### R2.1 Workspace CRUD

```
Context: context.md §5 (routes), context.md §4 (DB schema)
Reference: backend/app/routes/nodes.py, backend/app/services/node_service.py

Create:
- backend/app/schemas/workspace.py
  WorkspaceCreate: name (str, max 255), description (str | None)
  WorkspaceUpdate: name (str | None), description (str | None)
  WorkspaceResponse: id, name, description, created_at, updated_at, node_count (int)

- backend/app/repositories/workspace_repo.py
  list_workspaces() → list[Workspace]
  get_workspace(id) → Workspace | None
  create_workspace(data) → Workspace
  update_workspace(id, data) → Workspace
  delete_workspace(id) → None

- backend/app/services/workspace_service.py
  Calls repository. Raises 404 HTTPException if workspace not found.

- backend/app/routes/workspaces.py
  GET    /workspaces           → list
  POST   /workspaces           → create (201)
  GET    /workspaces/{id}      → get + all nodes as flat list
  PUT    /workspaces/{id}      → update
  DELETE /workspaces/{id}      → delete (204)

- tests/test_workspaces.py
  Test: create, get, update, delete, 404 cases.

Mount router in backend/app/main.py.
```

---

## R3 — Node API

### R3.1 FlowNode CRUD

```
Context: context.md §5 (routes + API routes table), context.md §4 (flow_nodes schema)
Reference: backend/app/schemas.py (existing NodeCreate/NodeUpdate pattern)
Reference: main.py NodeData dataclass for the full field list

Create:
- backend/app/schemas/node.py
  NodeType: Enum matching main.py NodeType (api, endpoint, request, response, field, model, step)
  NodeCreate: all NodeData fields mapped to Optional where appropriate.
              Required: name (str), node_type (NodeType), workspace_id (UUID).
              Optional: parent_id, position_x, position_y, all type-specific fields.
  NodeUpdate: all fields Optional (PATCH semantics)
  NodeResponse: all fields + id, created_at, updated_at, children: list[NodeResponse] (nested)

- backend/app/repositories/node_repo.py
  list_nodes(workspace_id) → list[FlowNode]    (flat, ordered by created_at)
  get_node(id) → FlowNode | None
  create_node(data) → FlowNode
  update_node(id, data) → FlowNode
  delete_node(id) → None   (cascade handled by FK ON DELETE CASCADE)
  get_tree(workspace_id) → FlowNode   (root node with nested children)

- backend/app/services/node_service.py
  list_nodes, get_node, create_node, update_node, delete_node, get_tree
  Validates: node_type is valid NodeType.
  Validates: parent node type allows this child type (use VALID_CONNECTIONS map).

- backend/app/routes/nodes.py
  GET    /workspaces/{workspace_id}/nodes            → flat list
  POST   /workspaces/{workspace_id}/nodes            → create (201)
  GET    /workspaces/{workspace_id}/nodes/tree       → nested tree
  PUT    /workspaces/{workspace_id}/nodes/{node_id}  → update
  DELETE /workspaces/{workspace_id}/nodes/{node_id}  → delete (204)

- tests/test_nodes.py
  Test: create API root node, add endpoint child, validate invalid connection rejected.
```

---

## R4 — Export API

### R4.1 Export Service

```
Context: main.py (Tree class: to_openapi(), to_json_schema(), to_agent_prompt())
Reference: backend/app/services/node_service.py

The export logic already exists in main.py as class methods on Tree.
Port this logic to backend/app/services/export_service.py as standalone functions
that accept list[FlowNode] (SQLAlchemy models) instead of a Tree object.

Create:
- backend/app/schemas/export.py
  ExportFormat: Enum → "openapi" | "schema" | "prompt"
  ExportRequest: format (ExportFormat), model_name (str | None), output_format ("json"|"yaml")
  ExportResponse: content (str), format (str), filename (str)

- backend/app/services/export_service.py
  build_tree(nodes: list[FlowNode]) → dict   (nested structure matching main.py Tree)
  to_openapi(nodes: list[FlowNode], output_format: str) → str
  to_json_schema(nodes: list[FlowNode], model_name: str | None) → str
  to_agent_prompt(nodes: list[FlowNode]) → str

  Port the exact logic from main.py Tree._oa_* and _ap_* methods.
  Translate FlowNode ORM fields → NodeData field names (they match with minor differences).

- backend/app/routes/exports.py
  POST /workspaces/{workspace_id}/export/openapi  → ExportResponse
  POST /workspaces/{workspace_id}/export/schema   → ExportResponse
  POST /workspaces/{workspace_id}/export/prompt   → ExportResponse

- tests/test_exports.py
  Test: build a minimal tree (api → endpoint → request → field), call to_openapi(),
  assert paths, components/schemas present in output.
```

---

## R5 — Execution API

### R5.1 Run Pipeline Endpoint

```
Context: context.md §5 (Celery tasks), backend/app/workers/tasks.py
Reference: backend/app/routes/executions.py, backend/app/services/execution_service.py

Create:
- backend/app/schemas/execution.py
  RunRequest: initial_context (dict), node_id (UUID | None) — if node_id given, run single
  RunResponse: run_id (UUID), status ("queued"), task_id (str)
  ExecutionDetail: node_id, node_name, status, input_data, output_data, error_message, duration_ms
  RunDetail: run_id, workspace_id, status, executions: list[ExecutionDetail], created_at

- backend/app/routes/executions.py
  POST /workspaces/{workspace_id}/run
    → dispatch Celery task execute_pipeline or execute_single_node
    → return RunResponse immediately (202 Accepted)

  GET /workspaces/{workspace_id}/executions
    → list all runs (grouped by run_id, ordered by latest first)

  GET /workspaces/{workspace_id}/executions/{run_id}
    → full detail for one run

- backend/app/services/execution_service.py
  dispatch_pipeline(workspace_id, initial_context) → RunResponse
  dispatch_single_node(workspace_id, node_id, input_data) → RunResponse
  list_runs(workspace_id) → list[RunSummary]
  get_run(workspace_id, run_id) → RunDetail

Use Celery's .apply_async() and return task_id in RunResponse for polling.
```

---

## R6 — Frontend: Canvas

### R6.1 React Flow Canvas Setup

```
Context: context.md §6 (React Flow Integration), context.md §7 (design system)
Stack: Next.js 14 App Router, @xyflow/react, TypeScript, Tailwind CSS

Create frontend/src/app/workspace/[id]/page.tsx:
- Fetch workspace + nodes via useNodes(workspaceId) (React Query).
- Render <FlowCanvas nodes={nodes} workspaceId={id} />.

Create frontend/src/components/canvas/FlowCanvas.tsx:
- ReactFlow component with:
  - nodeTypes: {api: ApiNode, endpoint: EndpointNode, ...}
  - onNodesChange: update position in DB (debounced 800ms PUT)
  - onConnect: create edge → POST new node with parent_id set
  - onNodeClick: setSelectedNodeId in canvasStore
  - Background (dots pattern, --bg-base color)
  - MiniMap (node colors from NODE_COLORS map)
  - Controls (zoom in/out/fit)
  - SelectionMode.Partial

Create frontend/src/lib/nodeTypes.ts:
  NODE_COLORS, NODE_ICONS, VALID_CONNECTIONS (from context.md)
  transformDbNodesToFlow(dbNodes: NodeResponse[]) → {nodes: FlowNode[], edges: Edge[]}
  Edges derived from parent_id: parent is source, child is target.

Style: dark theme, --bg-base canvas background.
```

### R6.2 Custom Node Components

```
Context: context.md §7 (Node card anatomy, color tokens)
Reference: frontend/src/components/canvas/FlowCanvas.tsx

For each of the 7 node types, create a custom React Flow node component.
File: frontend/src/components/nodes/{NodeType}Node.tsx

Each node card must:
- Header: colored background (NODE_COLORS[type]), white icon + type label badge.
- Body: node name (bold), subtitle (path for ENDPOINT, field_type for FIELD, etc.).
- Top Handle (target): for receiving a parent connection. Hidden on API node.
- Bottom Handle (source): for spawning child connections.
- Selected state: 2px --primary border glow.
- Width: 180px min, truncate long names with ellipsis.

Specific subtitles:
  ApiNode:      version tag
  EndpointNode: method badge (GET=blue, POST=green, PUT=yellow, DELETE=red) + path
  ResponseNode: status_code badge (2xx=green, 4xx=yellow, 5xx=red)
  FieldNode:    field_type + format chip (e.g. "string (email)")
  ModelNode:    orm_table if set
  StepNode:     language badge + first line of code (truncated)
```

### R6.3 Properties Panel

```
Context: context.md §7 (Properties Panel), features.md F3
Reference: frontend/src/components/nodes/

Create frontend/src/components/panels/PropertiesPanel.tsx:
- Opens when selectedNodeId is set in canvasStore.
- Width: 320px, fixed right side, overlays canvas.
- Header: node type badge + inline-editable name field.
- Body: renders the correct form component based on node_type.
- Footer: "Delete Node" button → confirm dialog → DELETE API call.
- Close button (X) or Escape key deselects node.

Create one form per node type in frontend/src/components/forms/:
  ApiForm.tsx      → title, version, base_url, tech_stack, auth_scheme, architecture_notes
  EndpointForm.tsx → method (Select), path, summary, operation_id, tags (TagInput),
                     service_method, database_query, conditions (list editor), is_async
  RequestForm.tsx  → content_type (Select), validation_rules (list editor),
                     example (Monaco JSON editor)
  ResponseForm.tsx → status_code (number), is_error (Switch), error_type, model_ref (Select
                     populated from MODEL nodes in the workspace), example (Monaco JSON editor)
  FieldForm.tsx    → field_type (Select), field_format (Select), required, nullable,
                     read_only, write_only, constraints (FieldConstraintBuilder component)
  ModelForm.tsx    → base_class, orm_table, indexes (TagInput)
  StepForm.tsx     → language (Select), code (Monaco editor full height),
                     input_keys (TagInput), output_key (Input)

All forms: onChange → debounced PUT to update node. No explicit save button.
```

### R6.4 Export Panel

```
Context: features.md F4, backend POST /workspaces/{id}/export/*

Create frontend/src/components/panels/ExportPanel.tsx:
- Opens via "Export" button in CanvasToolbar.
- Full-height right panel (or modal) with three tabs: OpenAPI | JSON Schema | Agent Prompt.
- Each tab:
  - Calls POST /workspaces/{id}/export/{type} via useExport() hook.
  - Renders output in Monaco Editor (readOnly, dark theme).
  - Action bar: [Copy] [Download] buttons.
  - OpenAPI tab only: [JSON / YAML] toggle, passed in request body.
- Loading skeleton while fetching. Error toast on failure.

Create frontend/src/hooks/useExport.ts:
  useExportOpenApi(workspaceId, format: 'json'|'yaml') → {data, isLoading, refetch}
  useExportSchema(workspaceId, modelName?) → {data, isLoading, refetch}
  useExportPrompt(workspaceId) → {data, isLoading, refetch}
```

---

## R7 — Frontend: Execution

### R7.1 Run Pipeline UI

```
Context: features.md F5, backend POST /workspaces/{id}/run

Create frontend/src/components/panels/ExecutionLogPanel.tsx:
- Bottom panel (collapsible, 200px height default).
- Tab: "Execution Log".
- Table: columns — run_id (truncated), started_at, status badge, duration, [View] button.
- Click [View] → side drawer with RunDetail (per-node status, inputs, outputs).
- Auto-refreshes every 3s while any run has status "PENDING" or "RUNNING".

In CanvasToolbar.tsx, add "Run" button:
- Opens RunModal: textarea for initial_context JSON input.
- [Run] button → POST /workspaces/{id}/run → shows toast "Pipeline queued (run_id: ...)".
- After queuing, opens ExecutionLogPanel automatically.

During run: each STEP node on canvas shows status indicator:
- Spinner (RUNNING), green dot (SUCCESS), red dot (ERROR).
- Derived from useExecutions() hook polling during active run.
```

---

## R8 — Frontend: Tree Outline + Canvas Actions

### R8.1 Tree Outline Panel

```
Context: features.md F6.1
Reference: frontend/src/components/panels/PropertiesPanel.tsx

Create frontend/src/components/panels/TreeOutlinePanel.tsx:
- Left panel, 256px wide, collapsible.
- Indented list of all nodes in parent→child order.
- Each row: [indent] [type icon] [node name]
- Selected node highlighted with --primary background.
- Click row → setSelectedNodeId + fitView to that node.
- Right-click row → context menu: Add Child, Duplicate, Delete.
```

### R8.2 Canvas Toolbar

```
Context: features.md F2, F4, F6

Create frontend/src/components/canvas/CanvasToolbar.tsx:
- Top bar, full width, --bg-surface background, --border bottom border.
- Left: workspace name (editable inline).
- Center: [Run ▶] [Validate ✓] [Auto Layout ⊞] buttons.
- Right: [Export] [Save] [last saved timestamp].

Validate button:
  Calls treeUtils.validateTree(nodes) → list of error strings.
  Shows error list in a toast or inline dropdown.

Auto Layout button:
  Uses dagre to compute x/y positions.
  Calls useUpdateNode for each node with new position.
  Then calls fitView().
```

### R8.3 Context Menu & Keyboard Shortcuts

```
Context: features.md F2.2, F7.1

Create frontend/src/components/canvas/CanvasContextMenu.tsx:
- Right-click blank canvas → shows: "Add Node" submenu (all 7 types).
- Right-click node → shows: "Edit", "Duplicate", "Add Child", "Delete".

Add keyboard handler to FlowCanvas.tsx:
  Delete / Backspace → delete selected nodes (with confirm dialog)
  Ctrl+Z             → canvasStore.undo()
  Ctrl+Y             → canvasStore.redo()
  Ctrl+S             → manual save trigger
  Ctrl+E             → open ExportPanel
  F                  → fitView()
  Escape             → deselect (setSelectedNodeId(null))
```

---

## R9 — Frontend: Dashboard

### R9.1 Workspace Dashboard

```
Context: features.md F1, context.md §7 (design system)

Create frontend/src/app/page.tsx (home/dashboard):
- Header: "FlowTree" logo + [New Workspace] button.
- Search input → filters workspace cards.
- Grid (3 columns): WorkspaceCard per workspace.
  Each card: workspace name, description (truncated), node count, last updated time, [Open] button.
- Empty state: "No workspaces yet. Create your first API tree."

WorkspaceCard interactions:
  Click card or [Open] → navigate to /workspace/{id}
  Right-click or ⋮ menu → Rename, Delete (with confirm dialog)

New Workspace:
  Modal: name input (required), description (optional) → POST /workspaces → navigate to new workspace.
```

---

## R10 — Quality & Infrastructure

### R10.1 Backend Tests

```
For each service file, write pytest tests with a test async DB session (SQLite in-memory or
PostgreSQL test DB). Use httpx AsyncClient for route-level tests.

Test files:
  tests/test_workspaces.py   → CRUD, 404 cases
  tests/test_nodes.py        → create, invalid connection rejected, cascade delete
  tests/test_exports.py      → to_openapi produces valid paths+components, to_agent_prompt contains model table
  tests/test_executions.py   → dispatch returns run_id, execution rows created after task

Minimum: 2 success paths + 1 error path per service function.
```

### R10.2 Import from OpenAPI (Stretch)

```
Context: features.md F6.4

Create backend/app/services/import_service.py:
  from_openapi(spec: dict, workspace_id: UUID) → list[FlowNode]
  Parses OpenAPI 3.0 spec dict.
  Creates: API root node, MODEL nodes from components/schemas,
           ENDPOINT nodes for each path+method, REQUEST + FIELD nodes, RESPONSE nodes.
  Returns flat list of FlowNode objects (not yet persisted).
  Caller (route) persists them in a transaction.

POST /workspaces/{id}/import/openapi
  Body: { spec: dict, merge: bool }
  If merge=false, delete all existing nodes first.
  Persist imported nodes. Return count.

Frontend: "Import" button in CanvasToolbar → file upload dialog (JSON/YAML) → POST.
```
