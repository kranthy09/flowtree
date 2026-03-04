import type { NodeResponse } from "@/types/node";

/**
 * Returns a list of human-readable error strings describing structural
 * problems in the API tree.  Empty array means the tree is valid.
 */
export function validateTree(nodes: NodeResponse[]): string[] {
  const errors: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 1. Exactly one API root node
  const apiRoots = nodes.filter((n) => n.node_type === "api" && n.parent_id === null);
  if (apiRoots.length === 0) {
    errors.push("Tree has no API root node.");
  } else if (apiRoots.length > 1) {
    errors.push(`Tree has ${apiRoots.length} API root nodes — expected exactly 1.`);
  }

  for (const node of nodes) {
    // 2. Nodes that reference a missing parent
    if (node.parent_id && !byId.has(node.parent_id)) {
      errors.push(`"${node.name}" references a missing parent node.`);
    }

    // 3. Non-api nodes at the root level
    if (node.parent_id === null && node.node_type !== "api") {
      errors.push(`"${node.name}" (${node.node_type}) has no parent — only API nodes may be roots.`);
    }

    // 4. Endpoint completeness
    if (node.node_type === "endpoint") {
      if (!node.path)   errors.push(`Endpoint "${node.name}" is missing a path.`);
      if (!node.method) errors.push(`Endpoint "${node.name}" is missing an HTTP method.`);
    }
  }

  return errors;
}
