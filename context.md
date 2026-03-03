# FlowTree — Context & Architecture

---

## 1. Project Principles

1. **Canvas-first** — every feature is accessible from the canvas. No separate forms pages.
2. **Spec-complete output** — exports must be production-grade OpenAPI 3.0, not approximations.
3. **Minimal surface** — one workspace = one tree. No nested workspaces, no folders.
4. **Optimistic UI** — every edit updates the canvas instantly; DB sync happens in background.
5. **Typed everywhere** — TypeScript on frontend, Pydantic v2 on backend. No `any` without reason.
6. **Single responsibility** — routes call services, services call repositories. No DB logic in routes.
7. **Async by default** — all FastAPI routes and SQLAlchemy queries are async.
8. **Docker-first** — every service runs in Docker. `docker compose up` starts everything.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Canvas | React Flow (`@xyflow/react`) |
| State | Zustand (client state) + React Query (server state) |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | FastAPI 0.115+ (async) |
| ORM | SQLAlchemy 2.0 async + Alembic |
| Validation | Pydantic v2 |
| Database | PostgreSQL 16 |
| Task queue | Celery 5 + Redis 7 |
| Task monitor | Flower |
| Container | Docker + Docker Compose |
| Package manager | uv (Python) / pnpm (Node) |

---

## 3. Folder Structure

```
flowtree/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, router mounts
│   │   ├── config.py             # Settings (pydantic-settings, .env)
│   │   ├── database.py           # Async engine, session factory
│   │   ├── dependencies.py       # Depends(get_db), Depends(get_celery)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── workspace.py      # Workspace model
│   │   │   ├── node.py           # FlowNode model (replaces NumberNode)
│   │   │   └── execution.py      # Execution model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── workspace.py      # WorkspaceCreate, WorkspaceResponse
│   │   │   ├── node.py           # NodeCreate, NodeUpdate, NodeResponse
│   │   │   ├── execution.py      # RunRequest, ExecutionResponse
│   │   │   └── export.py         # ExportRequest, ExportResponse
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── workspaces.py     # CRUD /workspaces
│   │   │   ├── nodes.py          # CRUD /workspaces/{id}/nodes
│   │   │   ├── executions.py     # POST /run, GET /executions
│   │   │   └── exports.py        # POST /export/openapi, /export/prompt, /export/schema
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── workspace_service.py
│   │   │   ├── node_service.py
│   │   │   ├── execution_service.py
│   │   │   └── export_service.py  # to_openapi(), to_agent_prompt(), to_json_schema()
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── workspace_repo.py
│   │   │   ├── node_repo.py
│   │   │   └── execution_repo.py
│   │   └── workers/
│   │       ├── __init__.py
│   │       ├── celery_app.py      # Celery app factory
│   │       └── tasks.py           # execute_pipeline, execute_node tasks
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_workspaces.py
│   │   ├── test_nodes.py
│   │   └── test_exports.py
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── pyproject.toml             # uv project file
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router
│   │   │   ├── layout.tsx         # Root layout (fonts, providers)
│   │   │   ├── page.tsx           # Dashboard (workspace list)
│   │   │   ├── workspace/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx   # Canvas page for one workspace
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── FlowCanvas.tsx          # React Flow root
│   │   │   │   ├── CanvasToolbar.tsx       # Top bar: save, run, export, layout
│   │   │   │   ├── CanvasContextMenu.tsx   # Right-click menu
│   │   │   │   └── NodePalette.tsx         # Left drag-to-add palette
│   │   │   ├── nodes/
│   │   │   │   ├── ApiNode.tsx
│   │   │   │   ├── EndpointNode.tsx
│   │   │   │   ├── RequestNode.tsx
│   │   │   │   ├── ResponseNode.tsx
│   │   │   │   ├── FieldNode.tsx
│   │   │   │   ├── ModelNode.tsx
│   │   │   │   └── StepNode.tsx
│   │   │   ├── panels/
│   │   │   │   ├── PropertiesPanel.tsx     # Right panel: node form
│   │   │   │   ├── TreeOutlinePanel.tsx    # Left panel: outline tree view
│   │   │   │   ├── ExportPanel.tsx         # Export tabs: OpenAPI/Schema/Prompt
│   │   │   │   └── ExecutionLogPanel.tsx   # Bottom: run history
│   │   │   ├── forms/
│   │   │   │   ├── ApiForm.tsx
│   │   │   │   ├── EndpointForm.tsx
│   │   │   │   ├── RequestForm.tsx
│   │   │   │   ├── ResponseForm.tsx
│   │   │   │   ├── FieldForm.tsx
│   │   │   │   ├── ModelForm.tsx
│   │   │   │   └── StepForm.tsx
│   │   │   └── ui/                # shadcn/ui components
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Select.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Dialog.tsx
│   │   │       ├── Tabs.tsx
│   │   │       └── CodeEditor.tsx  # Monaco wrapper
│   │   ├── hooks/
│   │   │   ├── useTree.ts          # React Query hooks for nodes CRUD
│   │   │   ├── useWorkspace.ts
│   │   │   ├── useExport.ts
│   │   │   └── useExecution.ts
│   │   ├── stores/
│   │   │   ├── canvasStore.ts      # Zustand: selected node, panel state, undo/redo
│   │   │   └── workspaceStore.ts   # Zustand: active workspace
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios client, base URL, interceptors
│   │   │   ├── nodeTypes.ts        # NODE_COLORS, NODE_ICONS, VALID_CONNECTIONS
│   │   │   ├── treeUtils.ts        # flatten tree, find ancestors, validate
│   │   │   └── exportUtils.ts      # Format OpenAPI/Schema/Prompt from node list
│   │   └── types/
│   │       ├── node.ts             # NodeType enum, NodeData, FlowNode
│   │       ├── workspace.ts
│   │       └── execution.ts
│   ├── public/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml             # Production compose
├── docker-compose.dev.yml         # Dev compose with hot reload
├── .env.example
├── features.md
├── context.md
├── request.md
└── checklist.md
```

---

## 4. Database Models

### `workspaces`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
name         VARCHAR(255) NOT NULL
description  TEXT
created_at   TIMESTAMPTZ DEFAULT now()
updated_at   TIMESTAMPTZ DEFAULT now()
```

### `flow_nodes`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
node_type       VARCHAR(20) NOT NULL  -- api|endpoint|request|response|field|model|step
name            VARCHAR(255) NOT NULL
description     TEXT
tags            JSONB DEFAULT '[]'
parent_id       UUID REFERENCES flow_nodes(id) ON DELETE CASCADE
position_x      FLOAT DEFAULT 0      -- canvas x position
position_y      FLOAT DEFAULT 0      -- canvas y position

-- API
title           VARCHAR(255)
version         VARCHAR(20)
base_url        VARCHAR(500)
tech_stack      TEXT
architecture_notes TEXT
auth_scheme     VARCHAR(100)

-- ENDPOINT
method          VARCHAR(10)           -- GET POST PUT PATCH DELETE
path            VARCHAR(500)
summary         VARCHAR(500)
operation_id    VARCHAR(255)
deprecated      BOOLEAN DEFAULT false
query_params    JSONB DEFAULT '[]'
service_method  VARCHAR(255)
database_query  TEXT
conditions      JSONB DEFAULT '[]'
is_async        BOOLEAN DEFAULT true

-- REQUEST / RESPONSE
content_type    VARCHAR(100) DEFAULT 'application/json'
model_ref       VARCHAR(255)
example         JSONB
validation_rules JSONB DEFAULT '[]'
status_code     INTEGER
is_error        BOOLEAN DEFAULT false
error_type      VARCHAR(100)

-- FIELD
field_type      VARCHAR(20)           -- string integer number boolean array object
field_format    VARCHAR(50)           -- email uuid date-time uri ...
required        BOOLEAN DEFAULT true
nullable        BOOLEAN DEFAULT false
read_only       BOOLEAN DEFAULT false
write_only      BOOLEAN DEFAULT false
default_value   JSONB
items_type      VARCHAR(20)
items_ref       VARCHAR(255)
object_ref      VARCHAR(255)
constraints     JSONB DEFAULT '{}'    -- {minLength, maxLength, pattern, minimum, ...}
field_example   JSONB

-- MODEL
base_class      VARCHAR(100)
orm_table       VARCHAR(100)
indexes         JSONB DEFAULT '[]'

-- STEP
language        VARCHAR(20) DEFAULT 'python'
code            TEXT
input_keys      JSONB DEFAULT '[]'
output_key      VARCHAR(255)

created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `executions`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id UUID REFERENCES workspaces(id)
run_id       UUID NOT NULL
node_id      UUID REFERENCES flow_nodes(id) ON DELETE CASCADE
status       VARCHAR(20) DEFAULT 'PENDING'  -- PENDING RUNNING SUCCESS ERROR SKIPPED
duration_ms  INTEGER
input_data   JSONB
output_data  JSONB
error_message TEXT
created_at   TIMESTAMPTZ DEFAULT now()
```

---

## 5. Backend Architecture

### Layer Rules
```
HTTP Request
    ↓
Router (routes/)        ← validates schema, calls service, returns response
    ↓
Service (services/)     ← business logic, calls repository, raises HTTPException
    ↓
Repository (repositories/) ← async DB queries, returns ORM objects
    ↓
PostgreSQL
```

**Never**: DB queries in routes. Business logic in repositories.

### API Routes

```
GET    /workspaces                    list all workspaces
POST   /workspaces                    create workspace
GET    /workspaces/{id}               get workspace + all nodes
PUT    /workspaces/{id}               rename/update workspace
DELETE /workspaces/{id}               delete workspace + cascade nodes

GET    /workspaces/{id}/nodes         list nodes (flat list with parent_id)
POST   /workspaces/{id}/nodes         create node
PUT    /workspaces/{id}/nodes/{node_id}  update node fields + position
DELETE /workspaces/{id}/nodes/{node_id}  delete node (cascade children)

POST   /workspaces/{id}/run           trigger Celery execution task
GET    /workspaces/{id}/executions    list execution history
GET    /workspaces/{id}/executions/{run_id}  get run detail

POST   /workspaces/{id}/export/openapi   returns OpenAPI spec JSON/YAML
POST   /workspaces/{id}/export/schema    returns JSON Schema for a model
POST   /workspaces/{id}/export/prompt    returns agent prompt Markdown
```

### Celery Tasks

```python
# workers/tasks.py
@celery_app.task
def execute_pipeline(workspace_id: str, run_id: str, initial_context: dict) -> dict:
    """Runs all STEP nodes in DFS order. Updates execution rows in real time."""

@celery_app.task
def execute_single_node(node_id: str, run_id: str, input_data: dict) -> dict:
    """Runs one STEP node. Used by 'Run This Node' feature."""
```

---

## 6. Frontend Architecture

### State Management

```
Zustand (canvasStore)
  selectedNodeId: string | null
  panelOpen: 'properties' | 'export' | 'execution' | null
  undoStack: Action[]
  redoStack: Action[]

Zustand (workspaceStore)
  activeWorkspaceId: string | null

React Query (@tanstack/react-query)
  useNodes(workspaceId)       → GET /workspaces/{id}/nodes
  useUpdateNode(...)          → PUT /workspaces/{id}/nodes/{node_id}
  useCreateNode(...)          → POST /workspaces/{id}/nodes
  useDeleteNode(...)          → DELETE /workspaces/{id}/nodes/{node_id}
  useExport(type, ...)        → POST /workspaces/{id}/export/{type}
  useExecutions(workspaceId)  → GET /workspaces/{id}/executions
```

### React Flow Integration

```
FlowCanvas.tsx
  nodes: FlowNode[]     ← derived from DB nodes via useNodes()
  edges: Edge[]         ← derived from parent_id relationships
  onNodesChange         → debounced PUT to update position_x / position_y
  onConnect            → POST create node relationship (update parent_id)
  onNodeClick          → setSelectedNodeId in canvasStore
  nodeTypes            → { api: ApiNode, endpoint: EndpointNode, ... }
```

### Valid Node Connections
```typescript
// lib/nodeTypes.ts
export const VALID_CONNECTIONS: Record<NodeType, NodeType[]> = {
  api:      ['endpoint', 'model'],
  endpoint: ['request', 'response', 'step'],
  request:  ['field'],
  response: ['field'],
  model:    ['field'],
  field:    ['field'],      // nested objects
  step:     ['step'],       // sequential pipeline
}
```

---

## 7. Design System

### Colors

```css
/* Background layers */
--bg-base:     #0F1117;   /* page background */
--bg-surface:  #1A1D27;   /* panels, cards */
--bg-elevated: #232636;   /* dropdowns, modals */
--border:      #2D3148;   /* borders, dividers */

/* Node type colors */
--node-api:      #1A1A2E;
--node-endpoint: #E07B39;
--node-request:  #2E86AB;
--node-response: #27AE60;
--node-error:    #E74C3C;
--node-field:    #6C757D;
--node-model:    #9B59B6;
--node-step:     #7B5EA7;

/* Brand / interactive */
--primary:   #6366F1;   /* indigo — buttons, links, focus rings */
--primary-hover: #4F46E5;

/* Semantic */
--success:   #22C55E;
--warning:   #F59E0B;
--error:     #EF4444;

/* Text */
--text-primary:   #F1F5F9;
--text-secondary: #94A3B8;
--text-muted:     #475569;
```

### Typography

```css
font-family: 'Inter', system-ui, sans-serif;   /* UI text */
font-family: 'JetBrains Mono', monospace;       /* code, schema fields */

/* Scale */
--text-xs:   0.75rem;    /* 12px — field labels, badges */
--text-sm:   0.875rem;   /* 14px — body, form inputs */
--text-base: 1rem;       /* 16px — panel headings */
--text-lg:   1.125rem;   /* 18px — section titles */
--text-xl:   1.25rem;    /* 20px — page titles */
```

### Spacing
- Base unit: `4px`. Use multiples: 4, 8, 12, 16, 24, 32, 48.
- Panel width: `320px` (right/left). Canvas fills the rest.
- Node card: min-width `180px`, padding `12px 16px`.

### Component Conventions

**Node card anatomy:**
```
┌──────────────────────────┐
│ [icon] [TYPE BADGE]      │  ← header: node type color background
│ Node Name                │  ← name: bold, white
│ subtitle / path          │  ← secondary text: muted
└──────────────────────────┘
  ○ (top handle — input)
  ○ (bottom handle — output)
```

**Properties Panel:**
- Header: node type badge + node name (editable inline).
- Body: scrollable form, grouped by section with `<fieldset>`.
- Footer: "Delete Node" button (destructive, red).

**Export Panel:**
- Three tabs: OpenAPI | JSON Schema | Agent Prompt.
- Code viewer: Monaco in readonly mode, dark theme.
- Action row: Copy | Download | (OpenAPI only) Toggle JSON/YAML.

---

## 8. Docker Compose Services

```yaml
services:
  db:        postgres:16-alpine        port 5432
  redis:     redis:7-alpine            port 6379
  backend:   ./backend  (FastAPI)      port 8000
  worker:    ./backend  (Celery)       no external port
  flower:    mher/flower               port 5555
  frontend:  ./frontend (Next.js)      port 3000
```

All services share `.env` for secrets (`DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`).

---

## 9. Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://flowtree:flowtree@db:5432/flowtree

# Redis / Celery
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# App
SECRET_KEY=change-me-in-production
ENVIRONMENT=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```
