import type { Edge, Node } from "@xyflow/react";
import type { NodeResponse, NodeType } from "@/types/node";

// ── Design-system node colors (context.md §7) ──────────────────────────────

export const NODE_COLORS: Record<NodeType, string> = {
  api:      "var(--node-api)",
  endpoint: "var(--node-endpoint)",
  request:  "var(--node-request)",
  response: "var(--node-response)",
  field:    "var(--node-field)",
  model:    "var(--node-model)",
  step:     "var(--node-step)",
};

export const NODE_ICONS: Record<NodeType, string> = {
  api:      "⚡",
  endpoint: "🔗",
  request:  "→",
  response: "←",
  field:    "·",
  model:    "□",
  step:     "▶",
};

// ── Valid parent → child connections (mirrors backend VALID_CONNECTIONS) ───

export const VALID_CONNECTIONS: Record<NodeType, NodeType[]> = {
  api:      ["endpoint", "model"],
  endpoint: ["request", "response", "step"],
  request:  ["field"],
  response: ["field"],
  model:    ["field"],
  field:    ["field"],   // nested objects
  step:     ["step"],    // sequential pipeline
};

// ── React Flow node data shape ─────────────────────────────────────────────

export interface FlowNodeData extends Record<string, unknown> {
  nodeResponse: NodeResponse;
}

export type FlowNode = Node<FlowNodeData>;

// ── DB → React Flow transform ──────────────────────────────────────────────

export function transformDbNodesToFlow(dbNodes: NodeResponse[]): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  const nodes: FlowNode[] = dbNodes.map((n) => ({
    id:       n.id,
    type:     n.node_type,
    position: { x: n.position_x, y: n.position_y },
    data:     { nodeResponse: n },
  }));

  const edges: Edge[] = dbNodes
    .filter((n) => n.parent_id != null)
    .map((n) => ({
      id:     `${n.parent_id!}-${n.id}`,
      source: n.parent_id!,
      target: n.id,
    }));

  return { nodes, edges };
}
