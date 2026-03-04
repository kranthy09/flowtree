"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

export function ApiNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node = data.nodeResponse;
  return (
    <NodeCard
      bgColor={NODE_COLORS.api}
      icon={NODE_ICONS.api}
      label="API"
      name={node.name}
      selected={!!selected}
      hasTarget={false}
    >
      {node.version && <Chip label={`v${node.version}`} />}
      {node.auth_scheme && <Chip label={node.auth_scheme} />}
    </NodeCard>
  );
}
