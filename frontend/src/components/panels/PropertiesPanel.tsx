"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useNodes, useUpdateNode, useDeleteNode } from "@/hooks/useNodes";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { NodeType } from "@/types/node";
import { ApiForm }      from "@/components/forms/ApiForm";
import { EndpointForm } from "@/components/forms/EndpointForm";
import { RequestForm }  from "@/components/forms/RequestForm";
import { ResponseForm } from "@/components/forms/ResponseForm";
import { FieldForm }    from "@/components/forms/FieldForm";
import { ModelForm }    from "@/components/forms/ModelForm";
import { StepForm }     from "@/components/forms/StepForm";

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position:        "fixed",
  top:             "48px",
  right:           0,
  width:           "320px",
  height:          "calc(100vh - 48px)",
  background:      "var(--bg-surface)",
  borderLeft:      "1px solid var(--border)",
  display:         "flex",
  flexDirection:   "column",
  zIndex:          10,
  fontFamily:      "sans-serif",
};

const HEADER: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            "8px",
  padding:        "12px 14px",
  borderBottom:   "1px solid var(--border)",
  flexShrink:     0,
};

const BODY: React.CSSProperties = {
  flex:       1,
  overflowY:  "auto",
  padding:    "14px",
};

const FOOTER: React.CSSProperties = {
  padding:      "12px 14px",
  borderTop:    "1px solid var(--border)",
  flexShrink:   0,
};

const NAME_INPUT: React.CSSProperties = {
  flex:         1,
  background:   "transparent",
  border:       "1px solid transparent",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.875rem",
  fontWeight:   700,
  padding:      "3px 6px",
  outline:      "none",
};

const CLOSE_BTN: React.CSSProperties = {
  background:   "none",
  border:       "none",
  color:        "var(--text-muted)",
  cursor:       "pointer",
  fontSize:     "1.1rem",
  lineHeight:   1,
  padding:      "2px 4px",
  borderRadius: "4px",
};

const DELETE_BTN: React.CSSProperties = {
  width:        "100%",
  padding:      "8px",
  background:   "var(--error)",
  color:        "#fff",
  border:       "none",
  borderRadius: "5px",
  cursor:       "pointer",
  fontWeight:   600,
  fontSize:     "0.8rem",
};

const CONFIRM_ROW: React.CSSProperties = {
  display:    "flex",
  gap:        "8px",
  marginTop:  "8px",
};

const CONFIRM_BTN: React.CSSProperties = {
  flex:         1,
  padding:      "7px",
  background:   "var(--error)",
  color:        "#fff",
  border:       "none",
  borderRadius: "4px",
  cursor:       "pointer",
  fontWeight:   600,
  fontSize:     "0.75rem",
};

const CANCEL_BTN: React.CSSProperties = {
  flex:         1,
  padding:      "7px",
  background:   "var(--bg-elevated)",
  color:        "var(--text-primary)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  cursor:       "pointer",
  fontSize:     "0.75rem",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  workspaceId: string;
}

export function PropertiesPanel({ workspaceId }: PropertiesPanelProps) {
  const selectedNodeId  = useCanvasStore((s) => s.selectedNodeId);
  const panelOpen       = useCanvasStore((s) => s.panelOpen);
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId);
  const closePanel      = useCanvasStore((s) => s.closePanel);

  const { data: allNodes }        = useNodes(workspaceId);
  const { mutate: updateMutate }  = useUpdateNode(workspaceId);
  const { mutate: deleteMutate }  = useDeleteNode(workspaceId);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Inline name editing ───────────────────────────────────────────────────
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localName, setLocalName] = useState("");

  const node = allNodes?.find((n) => n.id === selectedNodeId) ?? null;

  // Sync local name only when the selected node changes (not on every server update)
  useEffect(() => {
    setLocalName(node?.name ?? "");
    setConfirmDelete(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  // ── Escape key handler ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        closePanel();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedNodeId, closePanel]);

  // ── Name save (debounced 600ms) ───────────────────────────────────────────
  const saveName = useCallback((v: string) => {
    setLocalName(v);
    if (!node) return;
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      updateMutate({ nodeId: node.id, data: { name: v } });
    }, 600);
  }, [node, updateMutate]);

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!node) return;
    deleteMutate(node.id, {
      onSuccess: () => {
        setSelectedNodeId(null);
        closePanel();
      },
    });
  }

  // ── MODEL nodes for ResponseForm model_ref select ─────────────────────────
  const modelNodes = allNodes?.filter((n) => n.node_type === "model") ?? [];

  // Panel is visible only when panelOpen === "properties" and a node is selected
  if (panelOpen !== "properties" || !node) return null;

  const type    = node.node_type as NodeType;
  const bgColor = NODE_COLORS[type] ?? "var(--bg-elevated)";
  const icon    = NODE_ICONS[type] ?? "·";

  return (
    <div style={PANEL}>
      {/* ── Header ── */}
      <div style={HEADER}>
        {/* Type badge */}
        <span
          style={{
            background:   bgColor,
            borderRadius: "4px",
            padding:      "3px 7px",
            fontSize:     "0.6rem",
            fontWeight:   700,
            color:        "#fff",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flexShrink:   0,
          }}
        >
          {icon} {type}
        </span>

        {/* Inline editable name */}
        <input
          style={NAME_INPUT}
          value={localName}
          onChange={(e) => saveName(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
          onBlur={(e)  => (e.target.style.borderColor = "transparent")}
        />

        {/* Close */}
        <button
          style={CLOSE_BTN}
          onClick={() => { setSelectedNodeId(null); closePanel(); }}
          title="Close (Esc)"
        >
          ×
        </button>
      </div>

      {/* ── Body (scrollable form) ── */}
      <div style={BODY}>
        {type === "api"      && <ApiForm      key={node.id} node={node} workspaceId={workspaceId} />}
        {type === "endpoint" && <EndpointForm key={node.id} node={node} workspaceId={workspaceId} />}
        {type === "request"  && <RequestForm  key={node.id} node={node} workspaceId={workspaceId} />}
        {type === "response" && (
          <ResponseForm key={node.id} node={node} workspaceId={workspaceId} modelNodes={modelNodes} />
        )}
        {type === "field"    && <FieldForm    key={node.id} node={node} workspaceId={workspaceId} />}
        {type === "model"    && <ModelForm    key={node.id} node={node} workspaceId={workspaceId} />}
        {type === "step"     && <StepForm     key={node.id} node={node} workspaceId={workspaceId} />}
      </div>

      {/* ── Footer (delete) ── */}
      <div style={FOOTER}>
        {!confirmDelete ? (
          <button style={DELETE_BTN} onClick={() => setConfirmDelete(true)}>
            Delete Node
          </button>
        ) : (
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Delete this node and all its children?
            </p>
            <div style={CONFIRM_ROW}>
              <button style={CONFIRM_BTN} onClick={handleDelete}>Yes, Delete</button>
              <button style={CANCEL_BTN}  onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
