import Dagre from "@dagrejs/dagre";
import type { NodeResponse } from "@/types/node";

const NODE_W = 220;
const NODE_H = 70;

/**
 * Runs a Dagre top-down layout on the flat node list and returns a map of
 * nodeId → { x, y } top-left positions ready to persist to the backend.
 */
export function computeDagreLayout(
  nodes: NodeResponse[],
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const node of nodes) {
    if (node.parent_id) g.setEdge(node.parent_id, node.id);
  }

  Dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      // Dagre returns center coords; convert to top-left for React Flow
      positions.set(node.id, { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 });
    }
  }
  return positions;
}
