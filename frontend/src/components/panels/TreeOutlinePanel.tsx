"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore }              from "@/stores/canvasStore";
import { useNodes, useCreateNode, useDeleteNode } from "@/hooks/useNodes";
import { NODE_ICONS, VALID_CONNECTIONS }           from "@/lib/nodeTypes";
import type { NodeResponse, NodeType }             from "@/types/node";

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildChildMap(nodes: NodeResponse[]): Map<string | null, NodeResponse[]> {
  const map = new Map<string | null, NodeResponse[]>();
  for (const node of nodes) {
    const key = node.parent_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(node);
  }
  for (const [, children] of map) {
    children.sort((a, b) => a.position_y - b.position_y);
  }
  return map;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_EXPANDED: React.CSSProperties = {
  position:      "fixed",
  top:           "48px",
  left:          0,
  width:         "256px",
  height:        "calc(100vh - 48px)",
  background:    "var(--bg-surface)",
  borderRight:   "1px solid var(--border)",
  display:       "flex",
  flexDirection: "column",
  zIndex:        10,
  fontFamily:    "sans-serif",
};

const PANEL_COLLAPSED: React.CSSProperties = {
  ...PANEL_EXPANDED,
  width: "36px",
};

const HEADER: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  padding:      "10px 10px",
  borderBottom: "1px solid var(--border)",
  flexShrink:   0,
  gap:          "6px",
};

const TOGGLE_BTN: React.CSSProperties = {
  background:   "none",
  border:       "none",
  color:        "var(--text-muted)",
  cursor:       "pointer",
  padding:      "2px 4px",
  borderRadius: "4px",
  fontSize:     "0.75rem",
  lineHeight:   1,
  flexShrink:   0,
};

// ── Context menu ──────────────────────────────────────────────────────────────

interface CtxMenu {
  nodeId: string;
  type:   NodeType;
  x:      number;
  y:      number;
}

interface ContextMenuProps {
  menu:        CtxMenu;
  workspaceId: string;
  nodes:       NodeResponse[];
  onClose:     () => void;
}

function ContextMenu({ menu, workspaceId, nodes, onClose }: ContextMenuProps) {
  const { mutate: createNode } = useCreateNode(workspaceId);
  const { mutate: deleteNode } = useDeleteNode(workspaceId);
  const setSelectedNodeId      = useCanvasStore((s) => s.setSelectedNodeId);
  const openPanel              = useCanvasStore((s) => s.openPanel);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose]);

  const validChildren = VALID_CONNECTIONS[menu.type] ?? [];
  const parentNode    = nodes.find((n) => n.id === menu.nodeId);

  function handleAddChild(childType: NodeType) {
    if (!parentNode) return;
    createNode({
      node_type:  childType,
      name:       `New ${childType}`,
      parent_id:  menu.nodeId,
      position_x: parentNode.position_x,
      position_y: parentNode.position_y + 150,
    }, {
      onSuccess: (created) => {
        setSelectedNodeId(created.id);
        openPanel("properties");
        onClose();
      },
    });
  }

  function handleDuplicate() {
    if (!parentNode) return;
    // Copy fields that make sense to duplicate
    const { name, node_type, parent_id, position_x, position_y, ...rest } = parentNode;
    createNode({
      node_type,
      name:       `${name} (copy)`,
      parent_id,
      position_x: position_x + 40,
      position_y: position_y + 40,
      ...rest,
    }, { onSuccess: onClose });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteNode(menu.nodeId, { onSuccess: onClose });
  }

  // Flip menu if it would overflow the bottom
  const menuHeight = 40 + validChildren.length * 28 + 60;
  const top = menu.y + menuHeight > window.innerHeight ? menu.y - menuHeight : menu.y;

  return (
    <div
      ref={menuRef}
      style={{
        position:     "fixed",
        top,
        left:         menu.x,
        background:   "var(--bg-surface)",
        border:       "1px solid var(--border)",
        borderRadius: "6px",
        zIndex:       100,
        minWidth:     "160px",
        boxShadow:    "0 4px 16px rgba(0,0,0,0.4)",
        overflow:     "hidden",
        fontFamily:   "sans-serif",
        fontSize:     "0.75rem",
      }}
    >
      {/* Add child items */}
      {validChildren.length > 0 && (
        <>
          <div style={{ padding: "4px 10px 2px", color: "var(--text-muted)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em" }}>
            ADD CHILD
          </div>
          {validChildren.map((childType) => (
            <MenuItem
              key={childType}
              label={`${NODE_ICONS[childType]}  ${childType}`}
              onClick={() => handleAddChild(childType)}
            />
          ))}
          <Divider />
        </>
      )}

      <MenuItem label="Duplicate" onClick={handleDuplicate} />
      <Divider />
      <MenuItem
        label={confirmDelete ? "Confirm delete?" : "Delete"}
        danger
        onClick={handleDelete}
      />
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding:    "6px 12px",
        cursor:     "pointer",
        color:      danger ? "var(--error)" : "var(--text-primary)",
        background: hover ? (danger ? "rgba(239,68,68,0.08)" : "var(--bg-elevated)") : "transparent",
      }}
    >
      {label}
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "var(--border)", margin: "2px 0" }} />;
}

// ── Outline row (recursive) ───────────────────────────────────────────────────

interface OutlineRowProps {
  node:        NodeResponse;
  depth:       number;
  childMap:    Map<string | null, NodeResponse[]>;
  workspaceId: string;
  onCtxMenu:   (nodeId: string, type: NodeType, x: number, y: number) => void;
}

function OutlineRow({ node, depth, childMap, workspaceId, onCtxMenu }: OutlineRowProps) {
  const selectedNodeId    = useCanvasStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId);
  const openPanel         = useCanvasStore((s) => s.openPanel);
  const setFitToNodeId    = useCanvasStore((s) => s.setFitToNodeId);

  const isSelected = selectedNodeId === node.id;
  const children   = childMap.get(node.id) ?? [];

  function handleClick() {
    setSelectedNodeId(node.id);
    openPanel("properties");
    setFitToNodeId(node.id);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onCtxMenu(node.id, node.node_type, e.clientX, e.clientY);
  }

  // Suppress unused warning — workspaceId is forwarded to children
  void workspaceId;

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.name}
        style={{
          display:     "flex",
          alignItems:  "center",
          height:      "28px",
          paddingLeft: `${8 + depth * 14}px`,
          paddingRight: "8px",
          cursor:      "pointer",
          gap:         "6px",
          borderLeft:  isSelected ? "2px solid var(--primary)" : "2px solid transparent",
          background:  isSelected ? "rgba(99,102,241,0.12)" : "transparent",
          color:       "var(--text-primary)",
          fontSize:    "0.75rem",
          userSelect:  "none",
        }}
      >
        <span style={{ flexShrink: 0, fontSize: "0.7rem" }}>{NODE_ICONS[node.node_type]}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      </div>

      {children.map((child) => (
        <OutlineRow
          key={child.id}
          node={child}
          depth={depth + 1}
          childMap={childMap}
          workspaceId={workspaceId}
          onCtxMenu={onCtxMenu}
        />
      ))}
    </>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface TreeOutlinePanelProps {
  workspaceId: string;
}

export function TreeOutlinePanel({ workspaceId }: TreeOutlinePanelProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [ctxMenu, setCtxMenu]       = useState<CtxMenu | null>(null);

  const { data: allNodes } = useNodes(workspaceId);
  const nodes   = allNodes ?? [];
  const childMap = buildChildMap(nodes);
  const roots    = (childMap.get(null) ?? []);

  function handleCtxMenu(nodeId: string, type: NodeType, x: number, y: number) {
    setCtxMenu({ nodeId, type, x, y });
  }

  if (collapsed) {
    return (
      <div style={PANEL_COLLAPSED}>
        <button
          style={{ ...TOGGLE_BTN, margin: "10px auto" }}
          onClick={() => setCollapsed(false)}
          title="Expand tree outline"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={PANEL_EXPANDED}>
        <div style={HEADER}>
          <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-primary)", flex: 1 }}>
            Tree
          </span>
          <button style={TOGGLE_BTN} onClick={() => setCollapsed(true)} title="Collapse">
            ‹
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {roots.length === 0 ? (
            <p style={{ padding: "12px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
              No nodes yet.
            </p>
          ) : (
            roots.map((root) => (
              <OutlineRow
                key={root.id}
                node={root}
                depth={0}
                childMap={childMap}
                workspaceId={workspaceId}
                onCtxMenu={handleCtxMenu}
              />
            ))
          )}
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          workspaceId={workspaceId}
          nodes={nodes}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}
