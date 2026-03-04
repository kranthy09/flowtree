# FlowTree — Developer Guide

FlowTree is a canvas-based tool for building API specifications as visual node trees.
You design your API structure visually, then export it to OpenAPI, JSON Schema, or coding-agent prompts.

---

## Getting Started

1. Open or create a workspace from the dashboard.
2. Right-click the blank canvas → **Add API Root** to place your first node.
3. Right-click any node → **Add Child** to expand the tree downward.
4. Click any node to open its **Properties panel** on the right and fill in details.
5. Click **Export** (toolbar) when ready to generate OpenAPI / JSON Schema output.

---

## Node Types

| Icon | Type         | Purpose                                                       |
|------|--------------|---------------------------------------------------------------|
| ⚡   | **API Root** | Top-level API definition. Title, base URL, auth scheme.       |
| 🔗   | **Endpoint** | A single route (`GET /users`). Method, path, operation ID.    |
| →    | **Request**  | The request body for an endpoint. Content-type, model ref.    |
| ←    | **Response** | A response variant (200, 404…). Status code, error flag.      |
| ·    | **Field**    | A single field inside a request, response, or model.          |
| □    | **Model**    | A reusable data model / schema (like a Pydantic class).       |
| ▶    | **Step**     | A code execution step in a pipeline (language + code block).  |

---

## Valid Tree Structure

Only **API Root** nodes can be placed on the blank canvas (no parent).
Every other node type must be a child of a compatible parent:

```
API Root
├── Endpoint
│   ├── Request
│   │   └── Field
│   ├── Response
│   │   └── Field
│   └── Step
│       └── Step        ← chained pipeline steps
└── Model
    └── Field
        └── Field       ← nested object fields
```

The **Add Child** menu automatically filters to only valid child types for the
node you right-clicked, so invalid connections are never offered.

---

## Building an API Endpoint — Step by Step

### 1. Create the API Root

Right-click blank canvas → **Add API Root**

In the Properties panel, fill in:
- **Name / Title** — e.g. `User Service`
- **Version** — e.g. `1.0.0`
- **Base URL** — e.g. `https://api.example.com`
- **Auth Scheme** — Bearer / API Key / None
- **Tech Stack** — e.g. `FastAPI, PostgreSQL`

---

### 2. Add an Endpoint

Right-click the API Root → **Add Child** → **Endpoint**

Fill in:
- **Name** — human label, e.g. `Create User`
- **Method** — GET / POST / PUT / PATCH / DELETE
- **Path** — e.g. `/users`
- **Summary** — one-line description
- **Operation ID** — e.g. `create_user`

---

### 3. Add a Request Body

Right-click the Endpoint → **Add Child** → **Request**

Fill in:
- **Content Type** — `application/json`
- **Model Ref** — reference to a Model node name (optional)

---

### 4. Add Request Fields

Right-click the Request → **Add Child** → **Field**

Fill in:
- **Name** — field name, e.g. `email`
- **Field Type** — string / integer / boolean / array / object
- **Required** — toggle on/off
- **Nullable** — toggle on/off
- **Default Value** — optional

Repeat for each field in the request body.

---

### 5. Add a Response

Right-click the Endpoint → **Add Child** → **Response**

Fill in:
- **Status Code** — e.g. `200`, `201`, `404`
- **Is Error** — toggle for error responses
- **Error Type** — e.g. `NotFound`, `ValidationError`

Add **Field** children to define the response body shape.

---

### 6. Add a Reusable Model (optional)

Right-click the API Root → **Add Child** → **Model**

Fill in:
- **Name** — e.g. `UserSchema`
- **Base Class** — e.g. `BaseModel`
- **ORM Table** — e.g. `users`

Add **Field** children to define the model's schema.
Reference this model from Request/Response nodes via **Model Ref**.

---

### 7. Add Pipeline Steps (optional)

Right-click an Endpoint → **Add Child** → **Step**

Fill in:
- **Language** — python / javascript / bash
- **Code** — the implementation code
- **Input Keys** — context keys this step reads
- **Output Key** — context key this step writes

Chain steps by right-clicking a Step → **Add Child** → **Step**.

---

## Canvas Interactions

### Right-click on blank canvas
| Action          | Result                              |
|-----------------|-------------------------------------|
| Add API Root    | Creates a root API node at cursor   |

### Right-click on a node
| Action          | Result                                                   |
|-----------------|----------------------------------------------------------|
| Edit            | Opens the Properties panel for that node                 |
| Duplicate       | Clones the node (same parent, offset position)           |
| Add Child ›     | Click to expand inline list of valid child types         |
| Delete          | Shows a confirmation bar at the top before deleting      |

### Click on a node
Opens the **Properties panel** on the right to edit all fields.

### Drag node handle
Drag from the bottom handle of one node to another to connect them manually
(only valid connections per the tree rules above are accepted).

---

## Keyboard Shortcuts

| Shortcut       | Action                              |
|----------------|-------------------------------------|
| `F`            | Fit all nodes into view             |
| `Delete` / `Backspace` | Delete selected node (shows confirm bar) |
| `Escape`       | Deselect / close menus / cancel delete |
| `Ctrl+S`       | Save workspace name                 |
| `Ctrl+E`       | Open Export panel                   |
| `Ctrl+Z`       | Undo *(stub — event-sourcing TBD)*  |
| `Ctrl+Y`       | Redo *(stub — event-sourcing TBD)*  |

---

## Toolbar Buttons

| Button        | Action                                                        |
|---------------|---------------------------------------------------------------|
| **▶ Run**     | Opens the Run Pipeline modal (provide JSON context, then run) |
| **✓ Validate**| Checks tree structure; lists issues (missing parents, etc.)   |
| **⊞ Auto Layout** | Runs Dagre top-down layout and repositions all nodes      |
| **↗ Export**  | Opens the Export panel (OpenAPI / JSON Schema / Prompt)       |
| **Save**      | Saves the workspace name                                      |

---

## Tree Outline Panel (left sidebar)

- Shows all nodes in hierarchy order.
- Click any row → selects the node and **fits it into view**.
- Collapse / expand the panel with the `‹` button.

---

## Export Formats

Open **Export** from the toolbar or press `Ctrl+E`:

| Format       | Output                                               |
|--------------|------------------------------------------------------|
| OpenAPI 3.1  | Full OpenAPI YAML spec generated from the tree       |
| JSON Schema  | JSON Schema for all models and fields                |
| Agent Prompt | Structured prompt for coding agents (GPT / Claude)   |

---

## Run Pipeline

Open **▶ Run** from the toolbar or the floating button (bottom-right):

1. Provide an **initial context** as a JSON object, e.g. `{ "user_id": 42 }`.
2. Click **▶ Run** — the pipeline executes all Step nodes in order.
3. The **Execution Log** panel (bottom) shows each run's status.
4. Each Step node on the canvas gets a status dot:
   - 🟡 Pending
   - 🔵 Running
   - 🟢 Success
   - 🔴 Error

---

## Tips

- Use **Auto Layout** after adding several nodes — it prevents overlapping.
- Use **Validate** before exporting to catch structural issues early.
- A workspace can have multiple API Root nodes (for multi-API projects).
- Model nodes are shared across the whole API Root; reference them by name from Request/Response nodes.
