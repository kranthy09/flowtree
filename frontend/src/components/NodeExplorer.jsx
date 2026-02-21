/**
 * NodeExplorer — hierarchical tree sidebar for Flow Tree nodes.
 *
 * Props: { nodes, onUpdate, onDelete }
 *
 * Children order per expanded node:  L slot → R slot → parent_id-only extras
 * Empty L/R slots shown when the sibling side is occupied.
 * First 3 depth levels auto-expanded on first visit; state persisted to localStorage.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const LS_KEY = "flowtree_explorer_expanded";
const VISIBLE_DEPTH = 2; // depths 0, 1, 2 visible by default → expand 0 and 1
const INDENT_PX = 20;
const TYPE_OPTIONS = ["input", "process", "output"];

// ─── Tree building ─────────────────────────────────────────────────────────────

function buildTree(nodes) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const explicitChildren = new Set();
  nodes.forEach((n) => {
    if (n.left_child_id != null) explicitChildren.add(n.left_child_id);
    if (n.right_child_id != null) explicitChildren.add(n.right_child_id);
  });

  // parent-only: has parent_id but is NOT an explicit L/R child of that parent
  const parentOnlyMap = new Map(); // parentId → childId[]
  nodes.forEach((n) => {
    if (
      n.parent_id != null &&
      !explicitChildren.has(n.id) &&
      nodeMap.has(n.parent_id)
    ) {
      const arr = parentOnlyMap.get(n.parent_id) ?? [];
      arr.push(n.id);
      parentOnlyMap.set(n.parent_id, arr);
    }
  });

  // Roots: not an explicit L/R child AND no reachable parent
  const roots = nodes.filter((n) => {
    if (explicitChildren.has(n.id)) return false;
    if (n.parent_id != null && nodeMap.has(n.parent_id)) return false;
    return true;
  });

  return { nodeMap, parentOnlyMap, roots };
}

/** Returns ordered child descriptors: L slot, R slot, then parent_id extras. */
function getChildItems(node, parentOnlyMap) {
  const items = [];
  const hasLR =
    node.left_child_id != null || node.right_child_id != null;

  if (hasLR) {
    items.push({ kind: "lr", side: "L", nodeId: node.left_child_id });
    items.push({ kind: "lr", side: "R", nodeId: node.right_child_id });
  }

  const extras = parentOnlyMap.get(node.id) ?? [];
  extras.forEach((id) => items.push({ kind: "extra", nodeId: id }));

  return items;
}

/** BFS: collect IDs to expand so that `visibleDepth` levels are visible. */
function computeDefaultExpanded(roots, nodeMap, parentOnlyMap, visibleDepth) {
  const expanded = new Set();
  const expandUpTo = visibleDepth - 1; // expand these depths → next level visible
  const queue = roots.map((n) => ({ id: n.id, depth: 0 }));

  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth > expandUpTo) continue;
    const node = nodeMap.get(id);
    if (!node) continue;
    expanded.add(id);
    getChildItems(node, parentOnlyMap).forEach((item) => {
      if (item.nodeId != null && nodeMap.has(item.nodeId))
        queue.push({ id: item.nodeId, depth: depth + 1 });
    });
  }
  return expanded;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const map = {
    input: "bg-blue-900/70 text-blue-300",
    process: "bg-amber-900/70 text-amber-300",
    output: "bg-green-900/70 text-green-300",
  };
  if (!type) return null;
  return (
    <span
      className={`shrink-0 text-[10px] px-1.5 py-px rounded font-medium leading-none ${
        map[type] ?? "bg-gray-700 text-gray-400"
      }`}
    >
      {type}
    </span>
  );
}

function SidePill({ side }) {
  const cls =
    side === "L"
      ? "border-indigo-700 text-indigo-400"
      : "border-violet-700 text-violet-400";
  return (
    <span
      className={`shrink-0 text-[10px] font-bold w-4 text-center border rounded leading-none py-px ${cls}`}
    >
      {side}
    </span>
  );
}

function nodeLabel(n) {
  if (!n) return "—";
  return `#${n.id}: ${n.name ?? `node ${n.id}`} (${n.value})`;
}

function availableAsChild(nodes, currentId, excludeId) {
  return nodes.filter(
    (n) =>
      n.id !== currentId &&
      n.id !== excludeId &&
      !nodes.some(
        (o) =>
          o.id !== currentId &&
          (o.left_child_id === n.id || o.right_child_id === n.id)
      )
  );
}

// ─── Inline edit form ─────────────────────────────────────────────────────────

function NodeEditForm({ node, allNodes, onSave, onCancel }) {
  const [val, setVal] = useState(String(node.value));
  const [name, setName] = useState(node.name ?? "");
  const [type, setType] = useState(node.type ?? "");
  const [pid, setPid] = useState(
    node.parent_id != null ? String(node.parent_id) : ""
  );
  const [lid, setLid] = useState(
    node.left_child_id != null ? String(node.left_child_id) : ""
  );
  const [rid, setRid] = useState(
    node.right_child_id != null ? String(node.right_child_id) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const others = allNodes.filter((n) => n.id !== node.id);
  const leftOpts = availableAsChild(allNodes, node.id, rid ? +rid : null);
  const rightOpts = availableAsChild(allNodes, node.id, lid ? +lid : null);

  // Always include currently-assigned child even if filtered
  const guardOpt = (opts, assignedId) =>
    assignedId != null && !opts.some((n) => n.id === assignedId)
      ? [allNodes.find((n) => n.id === assignedId) ?? { id: assignedId, name: null, value: "?" }]
      : [];

  const handleSave = async () => {
    const numVal = parseInt(val, 10);
    if (isNaN(numVal)) { setError("Value must be an integer"); return; }
    setLoading(true);
    setError("");
    try {
      await onSave(node.id, {
        value: numVal,
        name: name.trim() || null,
        type: type || null,
        parent_id: pid ? +pid : null,
        left_child_id: lid ? +lid : null,
        right_child_id: rid ? +rid : null,
      });
      onCancel();
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const sel =
    "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500";
  const lbl = "text-xs font-medium shrink-0 w-12";

  return (
    <div className="mx-1 mb-1 p-2.5 bg-gray-800/90 border border-indigo-800/60 rounded-lg space-y-1.5 text-gray-100">
      {/* Row 1 – value / name / type */}
      <div className="flex gap-1.5 flex-wrap">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          placeholder="Value"
          className="w-16 bg-gray-700 border border-indigo-500 rounded px-2 py-1 text-sm focus:outline-none"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="">— type —</option>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Row 2 – parent */}
      <div className="flex items-center gap-1.5">
        <span className={`${lbl} text-gray-500`}>Parent</span>
        <select value={pid} onChange={(e) => setPid(e.target.value)} className={sel}>
          <option value="">(none)</option>
          {others.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
        </select>
      </div>

      {/* Row 3 – L child */}
      <div className="flex items-center gap-1.5">
        <span className={`${lbl} text-indigo-400`}>L child</span>
        <select value={lid} onChange={(e) => setLid(e.target.value)} className={sel}>
          <option value="">(none)</option>
          {guardOpt(leftOpts, node.left_child_id).map((n) => (
            <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
          ))}
          {leftOpts.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
        </select>
      </div>

      {/* Row 4 – R child */}
      <div className="flex items-center gap-1.5">
        <span className={`${lbl} text-violet-400`}>R child</span>
        <select value={rid} onChange={(e) => setRid(e.target.value)} className={sel}>
          <option value="">(none)</option>
          {guardOpt(rightOpts, node.right_child_id).map((n) => (
            <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
          ))}
          {rightOpts.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
        </select>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={handleSave}
          disabled={loading}
          className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="text-xs bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white px-2 py-1 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Single tree node row (recursive) ─────────────────────────────────────────

function TreeNode({
  nodeId,
  depth,
  side,
  nodeMap,
  parentOnlyMap,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  allNodes,
  visited,
}) {
  // All hooks must be before any early return
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const node = nodeMap.get(nodeId);
  if (!node || visited.has(nodeId)) return null; // guard missing node + cycles

  const childVisited = new Set(visited);
  childVisited.add(nodeId);

  const isExpanded = expanded.has(nodeId);
  const childItems = getChildItems(node, parentOnlyMap);
  const hasChildren = childItems.some((c) => c.nodeId != null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteErr("");
    try {
      await onDelete(node.id);
    } catch (err) {
      setDeleteErr(err.message || "Delete failed");
      setDeleting(false);
    }
  };

  const pl = depth * INDENT_PX + 6; // left padding

  return (
    <div>
      {/* ── Node row ── */}
      <div
        className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded-md transition-colors
          hover:bg-gray-800/70 ${editing ? "bg-gray-800/70" : ""}`}
        style={{ paddingLeft: pl }}
      >
        {/* Side pill (L/R) or spacer */}
        {side ? <SidePill side={side} /> : <span className="w-4 shrink-0" />}

        {/* Expand / collapse toggle */}
        <button
          onClick={() => hasChildren && onToggle(nodeId)}
          className={`w-4 h-4 shrink-0 flex items-center justify-center rounded text-xs
            ${
              hasChildren
                ? "text-gray-400 hover:text-white hover:bg-gray-700"
                : "text-gray-700 cursor-default"
            }`}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (isExpanded ? "▾" : "▸") : "·"}
        </button>

        {/* ID */}
        <span className="text-gray-600 text-xs shrink-0">#{node.id}</span>

        {/* Value */}
        <span className="font-mono text-sm text-gray-100 shrink-0">
          {node.value}
        </span>

        {/* Name */}
        {node.name && (
          <span
            className="text-gray-400 text-xs truncate min-w-0"
            title={node.name}
          >
            {node.name}
          </span>
        )}

        {/* Type badge */}
        <TypeBadge type={node.type} />

        {/* Actions */}
        <div className="ml-auto flex gap-1 shrink-0">
          <button
            onClick={() => {
              setEditing((e) => !e);
              setDeleteErr("");
            }}
            className={`text-xs px-1.5 py-0.5 rounded leading-none
              ${
                editing
                  ? "bg-indigo-700 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
              }`}
            title={editing ? "Close editor" : "Edit node"}
          >
            {editing ? "×" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-red-900/50 hover:bg-red-800 disabled:opacity-40
                       text-red-400 hover:text-white px-1.5 py-0.5 rounded leading-none"
            title="Delete node"
          >
            Del
          </button>
        </div>
      </div>

      {/* Delete error */}
      {deleteErr && (
        <p className="text-red-400 text-xs pb-1" style={{ paddingLeft: pl + 28 }}>
          {deleteErr}
        </p>
      )}

      {/* Inline edit form */}
      {editing && (
        <NodeEditForm
          node={node}
          allNodes={allNodes}
          onSave={onUpdate}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Children */}
      {isExpanded &&
        childItems.map((item) => {
          // Empty L/R slot
          if (item.kind === "lr" && item.nodeId == null) {
            return (
              <div
                key={`${nodeId}-${item.side}-empty`}
                className="flex items-center gap-1.5 py-1"
                style={{ paddingLeft: (depth + 1) * INDENT_PX + 6 }}
              >
                <SidePill side={item.side} />
                <span className="w-4 shrink-0" />
                <span className="text-xs text-gray-700 border border-dashed border-gray-700 px-2 py-0.5 rounded-sm italic">
                  empty
                </span>
              </div>
            );
          }

          if (item.nodeId == null) return null;

          return (
            <TreeNode
              key={item.nodeId}
              nodeId={item.nodeId}
              depth={depth + 1}
              side={item.kind === "lr" ? item.side : null}
              nodeMap={nodeMap}
              parentOnlyMap={parentOnlyMap}
              expanded={expanded}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              allNodes={allNodes}
              visited={childVisited}
            />
          );
        })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function NodeExplorer({ nodes, onUpdate, onDelete }) {
  const { nodeMap, parentOnlyMap, roots } = useMemo(
    () => buildTree(nodes),
    [nodes]
  );

  // Initialize expanded from localStorage or null (defaults computed in effect)
  const [expanded, setExpanded] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw !== null) return new Set(JSON.parse(raw));
    } catch {}
    return null; // triggers default-expand effect
  });

  // Compute and apply default expanded state once nodes are available
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current || nodes.length === 0) return;
    defaultsApplied.current = true;
    try {
      if (localStorage.getItem(LS_KEY) !== null) return; // user has prior state
    } catch {}
    const defaults = computeDefaultExpanded(
      roots,
      nodeMap,
      parentOnlyMap,
      VISIBLE_DEPTH
    );
    setExpanded(defaults);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify([...defaults]));
    } catch {}
  }, [nodes, roots, nodeMap, parentOnlyMap]);

  const expandedSet = expanded ?? new Set();

  const handleToggle = useCallback((nodeId) => {
    setExpanded((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  // Fallback: if tree building leaves orphans out of roots, surface them
  const displayRoots = roots.length > 0 ? roots : nodes;

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        No nodes yet — add one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/50 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold select-none">
          Node Explorer
        </span>
        <span className="text-[10px] text-gray-700 select-none">
          {nodes.length} node{nodes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable tree */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1">
        {displayRoots.map((root) => (
          <TreeNode
            key={root.id}
            nodeId={root.id}
            depth={0}
            side={null}
            nodeMap={nodeMap}
            parentOnlyMap={parentOnlyMap}
            expanded={expandedSet}
            onToggle={handleToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
            allNodes={nodes}
            visited={new Set()}
          />
        ))}
      </div>
    </div>
  );
}
