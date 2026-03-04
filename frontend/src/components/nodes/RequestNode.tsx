"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

export function RequestNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node = data.nodeResponse;
  return (
    <NodeCard
      bgColor={NODE_COLORS.request}
      icon={NODE_ICONS.request}
      label="Request"
      name={node.name}
      selected={!!selected}
    >
      {node.content_type && <Chip label={node.content_type} mono />}
      {node.model_ref && <Chip label={node.model_ref} />}
    </NodeCard>
  );
}
