# FlowTree — Features

## Vision
A canvas-first tool where developers build API specifications as visual trees.
Nodes represent API concepts (endpoints, fields, steps). The tree exports directly
to OpenAPI specs, JSON Schema, and coding-agent prompts — closing the loop from
requirements to generated code.

---

## F1 — Workspace Management

### F1.1 Create / Rename / Delete Workspace
- A workspace is a named container for one API tree.
- Listed on the home/dashboard screen.
- Each workspace has: `name`, `description`, `created_at`, `updated_at`.

### F1.2 Workspace Persistence
- All trees are auto-saved to PostgreSQL on every node change (debounced 800ms).
- Manual save button with last-saved timestamp indicator.

### F1.3 Workspace List & Search
- Grid of workspace cards on the dashboard.
- Search by name. Sort by last modified.

---

## F2 — Canvas (Core)

### F2.1 Interactive Tree Canvas
- Full-screen canvas powered by **React Flow**.
- Pan (drag background), zoom (scroll or pinch), fit-to-view button.
- Mini-map in bottom-right corner.
- Grid snap for clean layouts.

### F2.2 Node Creation on Canvas
- **Right-click** blank canvas → context menu → "Add Node" → pick node type.
- **Double-click** blank canvas → quick-add with default `STEP` type.
- Toolbar palette on left sidebar: drag a node type onto the canvas.
- Each new node placed at cursor position.

### F2.3 Node Types on Canvas
Seven distinct visual styles matching `NodeType`:

| Type | Color | Icon | Role |
|------|-------|------|------|
| API | `#1A1A2E` (navy) | Globe | Root — API system definition |
| ENDPOINT | `#E07B39` (orange) | Zap | HTTP route (`GET /users`) |
| REQUEST | `#2E86AB` (blue) | ArrowDown | Request body container |
| RESPONSE | `#27AE60` (green) / `#E74C3C` (red if error) | ArrowUp | HTTP response |
| FIELD | `#6C757D` (grey) | Tag | One schema field with type+constraints |
| MODEL | `#9B59B6` (purple) | Layers | Reusable $ref schema |
| STEP | `#7B5EA7` (lavender) | Play | Runnable pipeline stage |

### F2.4 Node Editing on Canvas
- **Single-click** node → select (highlight border, open Properties Panel on right).
- **Double-click** node → inline name editing directly on the node.
- Properties Panel: full form for all `NodeData` fields relevant to the node type.
  - API: title, version, base_url, tech_stack, auth_scheme
  - ENDPOINT: method, path, summary, operation_id, tags, service_method, conditions
  - REQUEST: content_type, validation_rules, example (JSON editor)
  - RESPONSE: status_code, is_error, error_type, model_ref, example
  - FIELD: field_type, field_format, required, read_only, write_only, constraints
  - MODEL: base_class, orm_table, indexes
  - STEP: language, code (code editor with syntax highlighting), input_keys, output_key

### F2.5 Node Connection (Parent → Child)
- Drag from the bottom handle of a parent node to the top handle of a child node.
- Only valid parent→child combinations are allowed (enforced visually):
  - API → ENDPOINT, MODEL
  - ENDPOINT → REQUEST, RESPONSE, STEP
  - REQUEST → FIELD
  - RESPONSE → FIELD
  - MODEL → FIELD
  - FIELD → FIELD (for nested objects)
  - STEP → STEP (sequential pipeline)
- Invalid connection attempt shows a red snap and does nothing.

### F2.6 Node Deletion on Canvas
- Select node → `Delete` or `Backspace` key → confirm dialog.
- Right-click node → "Delete Node".
- Deleting a parent recursively deletes all children (with warning).
- Deleting an edge (connection) only disconnects, does not delete the child node.

### F2.7 Node Duplication
- Right-click node → "Duplicate" → clones node and its children, placed offset from original.

### F2.8 Multi-select & Group Move
- Drag to draw selection box → selects multiple nodes.
- Move selected group together.
- Delete all selected nodes at once.

### F2.9 Undo / Redo
- `Ctrl+Z` / `Ctrl+Y` for all canvas operations (add, delete, move, edit).
- History limited to 50 actions.

---

## F3 — Node Properties Panel

### F3.1 Context-Aware Form
- Right panel appears when a node is selected.
- Only shows fields relevant to the selected node type (no irrelevant fields).
- Changes apply immediately (optimistic update + debounced API save).

### F3.2 Code Editor for STEP Nodes
- Monaco Editor (VS Code engine) embedded in the panel.
- Syntax highlighting for Python, JavaScript, TypeScript.
- `input_keys` chips: add/remove keys this step reads from context.
- `output_key` field: what key this step writes to context.

### F3.3 JSON Editor for Examples & Schemas
- `example`, `input_schema`, `output_schema` fields use a Monaco JSON editor.
- Schema validation against the node's own field definitions.

### F3.4 Constraint Builder for FIELD Nodes
- Visual constraint inputs: min/max length sliders, pattern input with regex preview,
  enum value tag editor, min/max numeric inputs.

---

## F4 — Export

### F4.1 Export to OpenAPI 3.0 Spec
- Button in top toolbar: "Export → OpenAPI".
- Generates complete OpenAPI 3.0.3 JSON/YAML from the tree.
- Options: JSON or YAML output.
- Preview in modal with syntax-highlighted code viewer.
- Download as `openapi.json` or `openapi.yaml`.
- Copy to clipboard button.

### F4.2 Export to JSON Schema
- "Export → JSON Schema" → pick a MODEL node or the first REQUEST body.
- Downloads as `schema.json`.

### F4.3 Export to Agent Prompt
- "Export → Agent Prompt" → generates structured Markdown.
- Includes: tech stack, models (with field tables), endpoints (with request/response
  tables, validation rules, processing steps, business rules, examples).
- Preview + copy to clipboard.
- Download as `prompt.md`.

### F4.4 Export Panel
- Dedicated side panel (or modal) with tabs: OpenAPI | JSON Schema | Agent Prompt.
- All three outputs visible side-by-side or tab-switched.
- One-click copy for each.

---

## F5 — Execution (STEP Nodes)

### F5.1 Run Full Pipeline
- "Run" button in toolbar → executes all STEP nodes in DFS order via Celery task.
- Initial context passed as JSON in a Run modal.
- Real-time status: each node shows a spinner → green ✓ or red ✗ badge.

### F5.2 Run Single Node
- Right-click STEP node → "Run This Node".
- Opens modal: paste input JSON → click Run.
- Shows output or error inline in the Properties Panel.

### F5.3 Execution History
- Bottom panel: Execution Log tab.
- Lists all runs: run_id, started_at, status, duration.
- Click a run → see per-node results (inputs, outputs, errors, timing).
- Powered by Celery tasks tracked in `executions` table.

### F5.4 Celery + Flower
- All execution jobs dispatched to Celery workers.
- Flower dashboard available at `/flower` for task monitoring.

---

## F6 — Tree Management

### F6.1 Tree Structure Sidebar
- Left panel: collapsible tree outline view (like VS Code file tree).
- Each node shown as indented row with type icon + name.
- Click row → selects and pans canvas to that node.

### F6.2 Validate Tree
- "Validate" button → checks:
  - API root exists and has at least one ENDPOINT child.
  - Every ENDPOINT has at least one RESPONSE.
  - Every RESPONSE with `model_ref` points to an existing MODEL.
  - No orphan nodes (nodes with no parent connection).
- Errors shown as a list with "Jump to node" links.

### F6.3 Auto-layout
- "Auto Layout" button → re-arranges all nodes in clean top-down hierarchy.
- Uses Dagre layout algorithm via `@dagrejs/dagre`.

### F6.4 Import from OpenAPI Spec
- "Import → OpenAPI JSON/YAML" → parses spec and builds the tree automatically.
- Merges or replaces existing tree (user chooses).

---

## F7 — UI / UX Extras

### F7.1 Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+E` | Export panel |
| `Delete` | Delete selected node(s) |
| `F` | Fit canvas to view |
| `Space+Drag` | Pan |
| `Escape` | Deselect / close panel |

### F7.2 Node Search
- `Ctrl+K` → search bar → type node name → highlights and pans to matching nodes.

### F7.3 Dark / Light Mode
- Toggle in header. Default: dark.

### F7.4 Minimap
- React Flow built-in minimap. Node colors match type colors.
