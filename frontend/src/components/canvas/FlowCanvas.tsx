"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ApiNode }      from "@/components/nodes/ApiNode";
import { EndpointNode } from "@/components/nodes/EndpointNode";
import { RequestNode }  from "@/components/nodes/RequestNode";
import { ResponseNode } from "@/components/nodes/ResponseNode";
import { FieldNode }    from "@/components/nodes/FieldNode";
import { ModelNode }    from "@/components/nodes/ModelNode";
import { StepNode }     from "@/components/nodes/StepNode";

import { useNodes, useUpdateNode, useDeleteNode } from "@/hooks/useNodes";
import { NODE_COLORS, VALID_CONNECTIONS, transformDbNodesToFlow } from "@/lib/nodeTypes";
import type { FlowNode }    from "@/lib/nodeTypes";
import { useCanvasStore }   from "@/stores/canvasStore";
import type { CanvasState } from "@/stores/canvasStore";
import type { NodeResponse, NodeType } from "@/types/node";

// ── Node-type registry ───────────────────────────────────────────────────────

const nodeTypes = {
  api:      ApiNode,
  endpoint: EndpointNode,
  request:  RequestNode,
  response: ResponseNode,
  field:    FieldNode,
  model:    ModelNode,
  step:     StepNode,
} as const;

const DEBOUNCE_MS = 800;

// ── FitViewEffect — inside ReactFlow context ──────────────────────────────────

function FitViewEffect() {
  const fitToNodeId    = useCanvasStore((s: CanvasState) => s.fitToNodeId);
  const setFitToNodeId = useCanvasStore((s: CanvasState) => s.setFitToNodeId);
  const { fitView }    = useReactFlow();

  useEffect(() => {
    if (!fitToNodeId) return;
    if (fitToNodeId === "__ALL__") {
      fitView({ duration: 500 });
    } else {
      fitView({ nodes: [{ id: fitToNodeId }], duration: 500, maxZoom: 1.5 });
    }
    setFitToNodeId(null);
  }, [fitToNodeId, fitView, setFitToNodeId]);

  return null;
}

// ── DeleteConfirmBar ──────────────────────────────────────────────────────────

const DELETE_BAR = {
  position:     "fixed",
  top:          "56px",
  left:         "50%",
  transform:    "translateX(-50%)",
  background:   "var(--bg-surface)",
  border:       "1px solid var(--error)",
  borderRadius: "8px",
  padding:      "8px 16px",
  display:      "flex",
  alignItems:   "center",
  gap:          "10px",
  zIndex:       40,
  fontFamily:   "sans-serif",
  fontSize:     "0.8rem",
  color:        "var(--text-primary)",
  boxShadow:    "0 4px 16px rgba(0,0,0,0.4)",
};

function DeleteConfirmBar({ workspaceId }: { workspaceId: string }) {
  const pendingDeleteId    = useCanvasStore((s: CanvasState) => s.pendingDeleteId);
  const setPendingDeleteId = useCanvasStore((s: CanvasState) => s.setPendingDeleteId);
  const setSelectedNodeId  = useCanvasStore((s: CanvasState) => s.setSelectedNodeId);
  const { data: dbNodes }  = useNodes(workspaceId);
  const { mutate: del }    = useDeleteNode(workspaceId);

  if (!pendingDeleteId) return null;

  const node = (dbNodes ?? []).find((n: NodeResponse) => n.id === pendingDeleteId);
  const name = node?.name ?? "this node";

  function confirm() {
    del(pendingDeleteId!, {
      onSuccess: () => { setPendingDeleteId(null); setSelectedNodeId(null); },
    });
  }

  return (
    <div style={DELETE_BAR}>
      <span>Delete <strong>"{name}"</strong>?</span>
      <button
        onClick={confirm}
        style={{ padding: "4px 12px", background: "var(--error)", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}
      >
        Delete
      </button>
      <button
        onClick={() => setPendingDeleteId(null)}
        style={{ padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.75rem" }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── FlowCanvas ────────────────────────────────────────────────────────────────

interface FlowCanvasProps { workspaceId: string }

export function FlowCanvas({ workspaceId }: FlowCanvasProps) {
  const { data: dbNodes }            = useNodes(workspaceId);
  const { mutate: updateNodeMutate } = useUpdateNode(workspaceId);
  const setSelectedNodeId            = useCanvasStore((s: CanvasState) => s.setSelectedNodeId);
  const openPanel                    = useCanvasStore((s: CanvasState) => s.openPanel);
  const setCtxMenu                   = useCanvasStore((s: CanvasState) => s.setCtxMenu);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ReactFlowInstance ref — gives screenToFlowPosition for context-menu coords
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // ── Sync DB → canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!dbNodes) return;
    const { nodes: fn, edges: fe } = transformDbNodesToFlow(dbNodes);
    setNodes(fn);
    setEdges(fe);
  }, [dbNodes, setNodes, setEdges]);

  // ── Debounced position persistence ────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef  = useRef<Map<string, { x: number; y: number }>>(new Map());

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position)
          pendingRef.current.set(change.id, change.position);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pendingRef.current.forEach((pos: { x: number; y: number }, nodeId: string) => {
          updateNodeMutate({ nodeId, data: { position_x: pos.x, position_y: pos.y } });
        });
        pendingRef.current.clear();
      }, DEBOUNCE_MS);
    },
    [onNodesChange, updateNodeMutate],
  );

  // ── onConnect ─────────────────────────────────────────────────────────────
  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      const sourceNode = nodes.find((n: FlowNode) => n.id === source);
      const targetNode = nodes.find((n: FlowNode) => n.id === target);
      if (!sourceNode || !targetNode) return;
      const parentType = sourceNode.data.nodeResponse.node_type as NodeType;
      const childType  = targetNode.data.nodeResponse.node_type as NodeType;
      if (!VALID_CONNECTIONS[parentType]?.includes(childType)) return;
      updateNodeMutate({ nodeId: target, data: { parent_id: source } });
    },
    [nodes, updateNodeMutate],
  );

  // ── Node click → select + open properties ─────────────────────────────────
  const handleNodeClick = useCallback(
    (_e: unknown, node: FlowNode) => {
      setSelectedNodeId(node.id);
      openPanel("properties");
    },
    [setSelectedNodeId, openPanel],
  );

  // ── Pane click → deselect + close ctx menu ─────────────────────────────────
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setCtxMenu(null);
  }, [setSelectedNodeId, setCtxMenu]);

  // ── Right-click: blank canvas ──────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const fp = rfInstanceRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: fp?.x ?? 0, flowY: fp?.y ?? 0, nodeId: null });
    },
    [setCtxMenu],
  );

  // ── Right-click: node ──────────────────────────────────────────────────────
  const handleNodeContextMenu = useCallback(
    (e: MouseEvent, node: FlowNode) => {
      e.preventDefault();
      e.stopPropagation(); // prevent canvas onContextMenu from overwriting nodeId with null
      const fp = rfInstanceRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: fp?.x ?? 0, flowY: fp?.y ?? 0, nodeId: node.id });
    },
    [setCtxMenu],
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // getState() is used so there are no stale-closure issues in the handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const store   = useCanvasStore.getState();
      const tag     = (document.activeElement?.tagName ?? "").toUpperCase();
      const inInput = ["INPUT", "TEXTAREA"].includes(tag);

      if (e.key === "Escape") {
        store.setSelectedNodeId(null);
        store.setCtxMenu(null);
        store.setPendingDeleteId(null);
        return;
      }
      if (inInput) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedNodeId) store.setPendingDeleteId(store.selectedNodeId);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        store.setFitToNodeId("__ALL__");
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); store.undo(); return; }
        if (e.key === "y") { e.preventDefault(); store.redo(); return; }
        if (e.key === "s") { e.preventDefault(); store.triggerSave(); return; }
        if (e.key === "e") { e.preventDefault(); store.openPanel("export"); return; }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance: ReactFlowInstance) => { rfInstanceRef.current = instance; }}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onContextMenu={handleContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        selectionMode={SelectionMode.Partial}
        fitView
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--border)"
          style={{ background: "var(--bg-base)" }}
        />
        <MiniMap
          nodeColor={(node: { data?: unknown }) => {
            const t = ((node.data as { nodeResponse?: { node_type?: string } } | undefined)
              ?.nodeResponse?.node_type) as NodeType | undefined;
            return t ? NODE_COLORS[t] : "#444";
          }}
          style={{ background: "var(--bg-surface)" }}
        />
        <Controls />
        <FitViewEffect />
      </ReactFlow>

      <DeleteConfirmBar workspaceId={workspaceId} />
    </div>
  );
}
