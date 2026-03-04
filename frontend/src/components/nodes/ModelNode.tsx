"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

export function ModelNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node = data.nodeResponse;
  return (
    <NodeCard
      bgColor={NODE_COLORS.model}
      icon={NODE_ICONS.model}
      label="Model"
      name={node.name}
      selected={!!selected}
    >
      {node.orm_table && <Chip label={node.orm_table} mono />}
      {node.base_class && <Chip label={node.base_class} />}
    </NodeCard>
  );
}
