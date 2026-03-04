"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore }   from "@/stores/canvasStore";
import type { CanvasState } from "@/stores/canvasStore";
import { useCreateNode, useNodes } from "@/hooks/useNodes";
import { VALID_CONNECTIONS, NODE_ICONS } from "@/lib/nodeTypes";
import type { NodeType, NodeResponse } from "@/types/node";

// ── Constants ─────────────────────────────────────────────────────────────────

// Only "api" nodes are allowed as root nodes (no parent_id) — backend enforces this.
const ROOT_TYPES: NodeType[] = ["api"];

const NODE_LABELS: Record<NodeType, string> = {
  api:      "API Root",
  endpoint: "Endpoint",
  request:  "Request",
  response: "Response",
  field:    "Field",
  model:    "Model",
  step:     "Step",
};

const MENU_W = 200;

// ── Menu item (top-level row) ──────────────────────────────────────────────────

function Item({
  label,
  icon,
  danger,
  expanded,
  showArrow,
  onClick,
}: {
  label:      string;
  icon?:      string;
  danger?:    boolean;
  expanded?:  boolean;
  showArrow?: boolean;
  onClick?:   () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "8px",
        padding:    "7px 12px",
        cursor:     "pointer",
        color:      danger ? "var(--error)" : "var(--text-primary)",
        background: hov ? "var(--bg-elevated)" : "transparent",
        userSelect: "none",
        fontSize:   "0.8rem",
      }}
    >
      {icon && (
        <span style={{ width: "16px", textAlign: "center", flexShrink: 0 }}>{icon}</span>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {showArrow && (
        <span
          style={{
            opacity:    0.55,
            fontSize:   "0.8em",
            transform:  expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            display:    "inline-block",
          }}
        >
          ›
        </span>
      )}
    </div>
  );
}

// ── Inline child-type row (indented, smaller) ──────────────────────────────────

function ChildItem({
  label,
  icon,
  onClick,
}: {
  label:   string;
  icon?:   string;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "8px",
        padding:    "6px 12px 6px 32px",
        cursor:     "pointer",
        color:      "var(--text-primary)",
        background: hov ? "var(--bg-elevated)" : "transparent",
        userSelect: "none",
        fontSize:   "0.75rem",
      }}
    >
      {icon && (
        <span style={{ width: "14px", textAlign: "center", flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      )}
      <span>{label}</span>
    </div>
  );
}

// ── CanvasContextMenu ─────────────────────────────────────────────────────────

interface CanvasContextMenuProps {
  workspaceId: string;
}

export function CanvasContextMenu({ workspaceId }: CanvasContextMenuProps) {
  const ctxMenu            = useCanvasStore((s: CanvasState) => s.ctxMenu);
  const setCtxMenu         = useCanvasStore((s: CanvasState) => s.setCtxMenu);
  const setSelectedNodeId  = useCanvasStore((s: CanvasState) => s.setSelectedNodeId);
  const openPanel          = useCanvasStore((s: CanvasState) => s.openPanel);
  const setPendingDeleteId = useCanvasStore((s: CanvasState) => s.setPendingDeleteId);

  const { data: dbNodes }      = useNodes(workspaceId);
  const { mutate: createNode } = useCreateNode(workspaceId);

  const menuRef               = useRef<HTMLDivElement>(null);
  const [childOpen, setChildOpen] = useState(false);

  // Close on outside mousedown
  useEffect(() => {
    if (!ctxMenu) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ctxMenu, setCtxMenu]);

  // Reset accordion when menu closes
  useEffect(() => { if (!ctxMenu) setChildOpen(false); }, [ctxMenu]);

  if (!ctxMenu) return null;

  const { screenX, screenY, flowX, flowY, nodeId } = ctxMenu;

  // Viewport-aware position (estimate height with accordion open)
  const estH = nodeId ? 220 : 52;
  const top  = screenY + estH > window.innerHeight ? Math.max(4, screenY - estH) : screenY;
  const left = screenX + MENU_W > window.innerWidth  ? Math.max(4, screenX - MENU_W) : screenX;

  function close() { setCtxMenu(null); }

  const shellStyle = {
    position:     "fixed" as const,
    top,
    left,
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow:    "0 8px 24px rgba(0,0,0,0.5)",
    minWidth:     `${MENU_W}px`,
    zIndex:       100,
    fontFamily:   "sans-serif",
    overflow:     "hidden",
  };

  // ── Node context menu ───────────────────────────────────────────────────────

  if (nodeId) {
    const node       = (dbNodes ?? []).find((n: NodeResponse) => n.id === nodeId);
    const nodeType   = node?.node_type as NodeType | undefined;
    const childTypes = nodeType ? (VALID_CONNECTIONS[nodeType] ?? []) : [];

    function handleEdit() {
      setSelectedNodeId(nodeId!);
      openPanel("properties");
      close();
    }

    function handleDuplicate() {
      if (!node) return;
      createNode(
        {
          node_type:  node.node_type,
          name:       `${node.name} (copy)`,
          parent_id:  node.parent_id,
          position_x: node.position_x + 40,
          position_y: node.position_y + 40,
        },
        { onSuccess: close },
      );
    }

    function handleAddChild(t: NodeType) {
      createNode(
        {
          node_type:  t,
          name:       `New ${NODE_LABELS[t]}`,
          parent_id:  nodeId!,
          position_x: (node?.position_x ?? 0) + 60,
          position_y: (node?.position_y ?? 0) + 120,
        },
        { onSuccess: close },
      );
    }

    function handleDelete() {
      setPendingDeleteId(nodeId!);
      close();
    }

    return (
      <div ref={menuRef} style={shellStyle}>
        {/* Node name header */}
        <div
          style={{
            padding:      "6px 12px 7px",
            fontSize:     "0.7rem",
            color:        "var(--text-muted)",
            fontWeight:   700,
            borderBottom: "1px solid var(--border)",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {node?.name ?? "Node"}
        </div>

        <div style={{ padding: "4px 0" }}>
          <Item label="Edit"      icon="✎" onClick={handleEdit} />
          <Item label="Duplicate" icon="⊕" onClick={handleDuplicate} />

          {childTypes.length > 0 && (
            <>
              {/* Accordion trigger */}
              <Item
                label="Add Child"
                icon="+"
                showArrow
                expanded={childOpen}
                onClick={() => setChildOpen((v) => !v)}
              />

              {/* Inline expanded child-type list */}
              {childOpen && (
                <div
                  style={{
                    borderTop:    "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    background:   "rgba(0,0,0,0.18)",
                    padding:      "4px 0",
                  }}
                >
                  {childTypes.map((t) => (
                    <ChildItem
                      key={t}
                      icon={NODE_ICONS[t]}
                      label={NODE_LABELS[t]}
                      onClick={() => handleAddChild(t)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "4px 0" }}>
          <Item label="Delete" icon="✕" danger onClick={handleDelete} />
        </div>
      </div>
    );
  }

  // ── Blank-canvas context menu ───────────────────────────────────────────────
  // Only root-valid types (currently just "api") can be created without a parent.

  function handleAddNode(t: NodeType) {
    createNode(
      {
        node_type:  t,
        name:       `New ${NODE_LABELS[t]}`,
        position_x: flowX,
        position_y: flowY,
      },
      { onSuccess: close },
    );
  }

  return (
    <div ref={menuRef} style={shellStyle}>
      <div style={{ padding: "4px 0" }}>
        {ROOT_TYPES.map((t) => (
          <Item
            key={t}
            icon={NODE_ICONS[t]}
            label={`Add ${NODE_LABELS[t]}`}
            onClick={() => handleAddNode(t)}
          />
        ))}
      </div>
    </div>
  );
}
