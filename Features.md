# Features — Flow Tree

## Overview

Flow Tree is an interactive node-based workflow builder. Users create numbered nodes, connect them into tree structures, and visualize the relationships as live diagrams. The system evolves through 6 incremental levels (0–5), each adding capability on top of the previous.

---

## Workspace Isolation

Every user gets an isolated workspace — no login required.

- **First Visit:** Backend generates a UUID workspace ID and sets it as an `HttpOnly` cookie. The frontend never sees or manages this value.
- **Every Request:** The cookie is sent automatically. Backend filters all queries by `workspace_id`.
- **Persistence:** Cookie lasts 1 year (`Max-Age=31536000`), renewed on each request.
- **New Workspace:** Clearing cookies starts a fresh workspace. No recovery mechanism — acceptable without real auth.
- **Security:** `HttpOnly` + `SameSite=Lax` prevents XSS from reading the workspace ID. JavaScript has zero access to it.

**What this means for the UI:** Nothing. The user sees their own nodes. No login screen, no workspace picker. It just works.

---

## Level 0: Numbers Only

**Core:** CRUD operations on integer nodes, scoped to the user's workspace.

- **Create Node:** Form with a single `value` (integer) field. Submit adds a row to `number_nodes` table (tagged with `workspace_id`) and the node appears instantly in the diagram.
- **List Nodes:** All nodes *for this workspace* render as a vertical list (table/cards) AND as a Mermaid diagram simultaneously. Both views stay in sync.
- **Delete Node:** Each node has a delete action. Deleting a node removes it from the database and the diagram.
- **Diagram View:** Mermaid `graph TD` renders all nodes. At Level 0, nodes are unconnected (isolated boxes). The diagram updates on every mutation.

**Acceptance:**
- Open app in Browser A → add 3 nodes → all 3 appear
- Open app in Browser B → sees empty state (different workspace)
- Browser A: delete 1 → only 2 remain
- Browser A: refresh → data persists
- Browser B: still empty (isolated)

---

## Level 1: Numbers with Properties

**Adds:** `name` (string) and `type` (enum) to each node.

- **Create/Edit Node:** Form gains `name` (text input) and `type` (dropdown: `input`, `process`, `output`).
- **Diagram:** Node labels show `name (value)`. Node color varies by `type`.
- **Filter/Search:** Optional — filter node list by `type`.

**Acceptance:**
- Create node with name="validate_amount", type="process", value=42
- Diagram shows: `validate_amount (42)` with process-colored box

---

## Level 2: Single Relationship (Parent)

**Adds:** `parent_id` FK — each node can have one parent.

- **Connect Nodes:** Dropdown on each node to select a parent from existing nodes (same workspace only). Setting a parent draws an arrow in the diagram from parent → child.
- **Disconnect:** Set parent to "none" to orphan a node.
- **Delete Cascade:** Deleting a parent orphans its children (does not delete them).
- **Diagram:** Arrows follow `parent_id` relationships. Forms a chain/linked-list structure.

**Acceptance:**
- Create A → B → C chain via parent dropdowns
- Diagram shows: A → B → C
- Delete B → A and C become independent roots

---

## Level 3: Tree Structure (Left/Right Children)

**Adds:** `left_child_id` and `right_child_id` FKs — full binary tree branching.

- **Connect Children:** Each node gains "left child" and "right child" dropdowns.
- **Diagram:** Tree renders with branching. Left children go left, right children go right.
- **Validation:** A node cannot be its own child. Circular references are rejected. Cross-workspace references are rejected.

**Acceptance:**
- Root node with left=B, right=C. B has left=D.
- Diagram:
  ```
      Root
      /  \
     B    C
    /
   D
  ```

---

## Level 4: Business Logic

**Adds:** Columns for what each node *does*.

- `service_method` — e.g., `"service.validate()"`
- `database_query` — e.g., `"SELECT * FROM users WHERE id = ?"`
- `external_api_call` — e.g., `"stripe.charge()"`
- `condition` — e.g., `"balance >= amount"`
- `input_schema` (JSON) — expected input shape
- `output_schema` (JSON) — expected output shape

- **Edit Panel:** Clicking a node opens a detail panel/modal with editable fields for all business logic columns.
- **Diagram:** Nodes can show a tooltip or subtitle with `service_method` or `condition`.

---

## Level 5: Execution Tracking

**Adds:** `executions` table to log runs through the tree (scoped to workspace).

- **Execute Flow:** A "Run" button triggers traversal from root → leaves, logging each node's execution.
- **Execution Log:** Table showing `node_id`, `status` (PENDING/SUCCESS/FAILED), `duration_ms`, `input_data`, `output_data`.
- **Diagram Overlay:** After execution, nodes color-code by status (green=success, red=failed, gray=pending).

---

## UI Layout (All Levels)

```
┌──────────────────────────────────────────┐
│  Flow Tree                    [+ Add]    │
├────────────────────┬─────────────────────┤
│                    │                     │
│   Node List        │   Mermaid Diagram   │
│   (left panel)     │   (right panel)     │
│                    │                     │
│   - id, value      │   graph TD          │
│   - name, type     │     A --> B         │
│   - parent picker  │     A --> C         │
│   - edit/delete    │                     │
│                    │                     │
├────────────────────┴─────────────────────┤
│  Detail Panel (Level 4+)                 │
└──────────────────────────────────────────┘
```

## Non-Features

- No user authentication (workspace cookie handles isolation)
- No real-time collaboration
- No undo/redo history
- No drag-and-drop node positioning (Mermaid handles layout)
- No workspace recovery after cookie deletion
- No cross-device sync
