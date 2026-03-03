# FlowTree — Checklists

---

## 1. Feature Development Checklist

Use this for every feature ticket. Check each item before marking the feature done.

### Backend
- [ ] Schema file created / updated (Pydantic v2, no v1 validators)
- [ ] Repository function written (async, returns ORM object or None)
- [ ] Service function written (calls repo, raises `HTTPException` on errors, no direct DB access)
- [ ] Route registered (calls service only, correct HTTP status codes)
- [ ] Router mounted in `backend/app/main.py`
- [ ] Alembic migration created if DB schema changed (`alembic revision --autogenerate`)
- [ ] Migration applied and verified (`alembic upgrade head`)
- [ ] At least 2 success + 1 error test per service function
- [ ] All tests passing (`pytest -x`)
- [ ] No raw SQL strings (use SQLAlchemy ORM or `text()` with bound params)
- [ ] No synchronous DB calls in async routes

### Frontend
- [ ] TypeScript types defined in `src/types/` for any new API response shape
- [ ] React Query hook created in `src/hooks/` for each new API call
- [ ] No direct `fetch`/`axios` calls in components (use hooks)
- [ ] Component uses design tokens from `context.md §7` (no hardcoded hex colors)
- [ ] No `any` types — fix or use `unknown` with a type guard
- [ ] Optimistic update or loading skeleton for every async operation
- [ ] Error state handled (toast or inline error message)
- [ ] Keyboard accessible (focusable, Enter/Space activates interactive elements)
- [ ] Tested in both dark and light mode (if toggle is implemented)

### Canvas-specific
- [ ] New node type added to `nodeTypes` map in `FlowCanvas.tsx`
- [ ] New node type added to `NODE_COLORS`, `NODE_ICONS`, `VALID_CONNECTIONS`
- [ ] Custom node component created in `components/nodes/`
- [ ] Form component created in `components/forms/`
- [ ] Properties panel renders correct form for this node type
- [ ] Context menu includes this node type in "Add Child" submenu (if applicable)
- [ ] Minimap reflects correct node color

### Export
- [ ] `to_openapi()` tested with a tree containing this node type
- [ ] `to_agent_prompt()` produces readable section for this node type
- [ ] `to_json_schema()` handles this node type correctly

---

## 2. Code Generation Principles

Rules for the coding agent to follow in every generation session.

### General
1. **Read before writing.** Read every file you will modify before touching it.
2. **One file at a time.** Generate complete files. Do not show partial diffs unless asked.
3. **No placeholders.** No `# TODO`, `pass`, `...`, or `raise NotImplementedError` in output.
4. **Match existing patterns.** If the codebase has a pattern (e.g., `async with db as session`), use it everywhere.
5. **No over-engineering.** Implement exactly what the request describes. No extra features.
6. **Delete dead code.** If you replace a function, remove the old one.

### Python / FastAPI
7. All route handlers are `async def`. All DB calls use `await`.
8. Route handlers return Pydantic response models, not raw dicts.
9. HTTPException status codes: 404 (not found), 422 (validation, handled by FastAPI), 409 (conflict), 400 (bad request), 500 (internal, avoid).
10. Never commit a raw password, secret key, or token. Use environment variables.
11. Use `model_validate(orm_obj)` (Pydantic v2) not `.from_orm()` (Pydantic v1).
12. SQLAlchemy: use `select()`, `scalars()`, `scalar_one_or_none()` — not `query()`.
13. Alembic: always use `--autogenerate`. Review migration before applying.
14. Tests: use `pytest-asyncio` with `asyncio_mode = "auto"`. Use `httpx.AsyncClient`.

### TypeScript / React / Next.js
15. All API calls go through `src/lib/api.ts` Axios instance.
16. All server state is managed by React Query (`@tanstack/react-query`).
17. All client state (UI: selected node, panel open) goes in Zustand stores.
18. Never use `useEffect` to fetch data. Use React Query hooks.
19. All props must be typed. No inline type objects for complex shapes — define in `src/types/`.
20. `className` strings: use `cn()` (clsx/tailwind-merge) for conditional classes.
21. Form inputs: controlled components. onChange debounced with `useDebouncedCallback` (react-use).
22. Next.js App Router: server components by default. Add `"use client"` only when needed (interactivity, hooks, canvas).
23. No hardcoded colors. Use CSS variables from `globals.css` or Tailwind tokens.

### React Flow
24. `onNodesChange` must only update positions (not other fields). Field edits go through the Properties Panel → API.
25. Never store API response data directly as React Flow node `data`. Transform via `transformDbNodesToFlow()`.
26. Custom node components must call `useNodeId()` to get their id — never rely on prop drilling.
27. `nodeTypes` object must be defined outside the component (stable reference) to avoid re-renders.

### Celery
28. Celery task functions must be synchronous (not async). Use a sync SQLAlchemy session inside tasks.
29. Tasks must be idempotent: if called twice with same run_id, second call is a no-op.
30. Always catch exceptions inside the task body and record them in the `executions` table.

---

## 3. Project Build Checklist

Step-by-step order to build the project from scratch. Complete each item fully before moving to the next.

### Phase 1: Foundation
- [ ] R1.1 — Docker Compose: add Redis, Celery worker, Flower
- [ ] R1.2 — Celery app factory + task stubs
- [ ] R1.3 — DB migration: create `workspaces` + `flow_nodes` tables
- [ ] Run `docker compose up` — all 6 services healthy

### Phase 2: Backend API
- [ ] R2.1 — Workspace CRUD routes + tests
- [ ] R3.1 — FlowNode CRUD routes + tests (including VALID_CONNECTIONS validation)
- [ ] R4.1 — Export service + routes (port logic from `main.py`)
- [ ] R5.1 — Execution dispatch route + Celery task body + tests
- [ ] All backend tests pass: `docker compose exec backend pytest`
- [ ] Manual test with `httpx` or curl: create workspace → add nodes → export OpenAPI

### Phase 3: Frontend Shell
- [ ] R9.1 — Dashboard page (workspace list + create)
- [ ] R6.1 — React Flow canvas setup (nodes render, edges from parent_id)
- [ ] R6.2 — All 7 custom node components (visual only, no forms yet)
- [ ] Canvas renders nodes from DB with correct colors and labels
- [ ] Pan, zoom, minimap working

### Phase 4: Canvas Interactions
- [ ] R6.3 — Properties Panel + all 7 form components
- [ ] R8.2 — Canvas Toolbar (save, validate, auto layout buttons)
- [ ] R8.3 — Context menu (right-click) + keyboard shortcuts
- [ ] R8.1 — Tree Outline Panel (left sidebar)
- [ ] Undo/Redo working for add/delete/move operations

### Phase 5: Exports & Execution
- [ ] R6.4 — Export Panel (three tabs: OpenAPI, Schema, Prompt)
- [ ] R7.1 — Run Pipeline UI (modal, log panel, node status badges)
- [ ] End-to-end test: build API tree → export OpenAPI → paste into Swagger UI → valid

### Phase 6: Polish
- [ ] R10.1 — Full backend test coverage (all services)
- [ ] R10.2 — Import from OpenAPI (stretch)
- [ ] Validate tree feature (R8.2) detects all error types from features.md F6.2
- [ ] All keyboard shortcuts working (features.md F7.1)
- [ ] Node search (Ctrl+K) working

---

## 4. Consistent Code Generation Session Template

Use this template when starting a new agent session:

```
You are building FlowTree, a canvas-based API specification tool.

Read these files before generating any code:
1. context.md     — architecture, folder structure, DB schema, design system
2. features.md    — feature specifications
3. checklist.md   — code generation principles (section 2)

Current task: [PASTE REQUEST FROM request.md HERE]

Rules:
- Follow all principles in checklist.md §2.
- Generate complete, working files — no placeholders.
- List every file you create or modify at the end of your response.
- If a file already exists, read it first and integrate your changes.
```

---

## 5. Pre-commit Checklist (Before Every Git Commit)

- [ ] `docker compose exec backend pytest` — all tests pass
- [ ] `docker compose exec frontend pnpm tsc --noEmit` — no TypeScript errors
- [ ] `docker compose exec frontend pnpm lint` — no ESLint errors
- [ ] No `.env` or secret files staged (`git status` check)
- [ ] Alembic migration included if models changed
- [ ] No `console.log`, `print()`, `breakpoint()` debug statements left in
- [ ] All new API endpoints documented (auto-generated via FastAPI at `/docs`)

---

## 6. Node Type Quick Reference

| NodeType | Parent(s) | Children | Key Fields |
|----------|-----------|----------|------------|
| `api` | — (root) | endpoint, model | title, version, base_url, tech_stack, auth_scheme |
| `endpoint` | api | request, response, step | method, path, operation_id, tags, service_method |
| `request` | endpoint | field | content_type, model_ref, validation_rules, example |
| `response` | endpoint | field | status_code, is_error, error_type, model_ref |
| `field` | request, response, model, field | field | field_type, field_format, required, constraints |
| `model` | api | field | base_class, orm_table, indexes |
| `step` | endpoint, step | step | language, code, input_keys, output_key |
