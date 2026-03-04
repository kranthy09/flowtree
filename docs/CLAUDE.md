# FlowTree — Claude Code Instructions

## Mandatory: Read These First

Before doing anything in this project, read these four files in order:

1. `features.md`  — what the product does (feature specs)
2. `context.md`   — architecture, folder structure, DB schema, design system, env vars
3. `request.md`   — the full list of feature requests (R1–R10)
4. `checklist.md` — code generation principles and build phases

Do not generate any code until you have read all four.

---

## Project in One Sentence

FlowTree is a canvas-based tool where developers build API specifications as
visual trees and export them to OpenAPI specs, JSON Schema, and coding-agent prompts.

## Stack

| Layer      | Tech                                              |
|------------|---------------------------------------------------|
| Frontend   | Next.js 14 (App Router) + React 18 + TypeScript   |
| Canvas     | `@xyflow/react` (React Flow)                      |
| State      | Zustand (UI) + React Query (server)               |
| Backend    | FastAPI (async) + Pydantic v2                     |
| ORM        | SQLAlchemy 2.0 async + Alembic                    |
| DB         | PostgreSQL 16                                     |
| Queue      | Celery 5 + Redis 7                                |
| Monitor    | Flower                                            |
| Containers | Docker + Docker Compose                           |

## Execution Environment

**All commands run inside Docker — never locally.**

```bash
# Start everything
docker compose up --build -d

# One-off commands
docker compose exec backend alembic upgrade head
docker compose exec backend pytest
docker compose exec backend pip install <pkg>

# Logs
docker compose logs -f backend
docker compose logs -f worker
```

Never use bare `python`, `pip`, `alembic`, or `pytest` on the host machine.
Always prefix with `docker compose exec <service>`.

---

## Non-Negotiable Rules

1. Read every file you will modify **before** modifying it.
2. Route → Service → Repository. Never skip layers.
3. All FastAPI routes and DB calls are `async`.
4. Pydantic v2 only (`model_validate`, not `.from_orm()`).
5. SQLAlchemy 2.0 only (`select()`, `scalars()`, not `query()`).
6. No hardcoded colors on frontend — use CSS variables from `context.md §7`.
7. No `any` in TypeScript — use `unknown` + type guard if needed.
8. No placeholders, `# TODO`, or `pass` in generated code.
9. Generate **complete files** — not partial diffs unless asked.
10. List every file created or modified at the end of your response.
11. **Never link to `/workspace/new`** — the `[id]` route passes `"new"` as a UUID to the backend → 422. Always POST to create the workspace first, then `router.push` to the returned UUID. Guard all workspace hooks with a UUID regex (`/^[0-9a-f-]{36}$/i`) on the `enabled` flag.

## Build Order

Follow the phases in `checklist.md §3` strictly:

- Phase 1: Docker + Celery + DB migration
- Phase 2: Backend API (workspaces, nodes, exports, executions)
- Phase 3: Frontend shell (dashboard + canvas)
- Phase 4: Canvas interactions (panels, forms, keyboard)
- Phase 5: Exports + execution UI
- Phase 6: Polish + tests

## Current Status

> Update this section after each completed request.

- [ ] Phase 1 — Foundation
  - [x] R1.1 Docker Compose (Redis, Celery, Flower)
  - [x] R1.2 Celery app factory + task stubs
  - [x] R1.3 DB migration: workspaces + flow_nodes
- [ ] Phase 2 — Backend API
  - [x] R2.1 Workspace CRUD
  - [x] R3.1 FlowNode CRUD
  - [x] R4.1 Export service + routes
  - [x] R5.1 Execution dispatch + Celery task
- [ ] Phase 3 — Frontend Shell
  - [ ] R9.1 Dashboard
  - [x] R6.1 React Flow canvas setup
  - [x] R6.2 Custom node components (all 7)
- [ ] Phase 4 — Canvas Interactions
  - [x] R6.3 Properties Panel + forms
  - [ ] R8.2 Canvas Toolbar
  - [ ] R8.3 Context menu + keyboard shortcuts
  - [ ] R8.1 Tree Outline Panel
- [ ] Phase 5 — Exports & Execution
  - [x] R6.4 Export Panel
  - [ ] R7.1 Run Pipeline UI
- [ ] Phase 6 — Polish
  - [ ] R10.1 Full backend tests
  - [ ] R10.2 Import from OpenAPI
