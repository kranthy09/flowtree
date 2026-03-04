"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

const METHOD_COLOR: Record<string, string> = {
  GET:     "#3B82F6",
  POST:    "#22C55E",
  PUT:     "#F59E0B",
  PATCH:   "#F59E0B",
  DELETE:  "#EF4444",
  HEAD:    "#94A3B8",
  OPTIONS: "#94A3B8",
};

export function EndpointNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node   = data.nodeResponse;
  const method = (node.method ?? "GET").toUpperCase();
  const color  = METHOD_COLOR[method] ?? "#94A3B8";

  return (
    <NodeCard
      bgColor={NODE_COLORS.endpoint}
      icon={NODE_ICONS.endpoint}
      label="Endpoint"
      name={node.name}
      selected={!!selected}
    >
      <Chip label={method} color={color} />
      {node.path && <Chip label={node.path} mono />}
    </NodeCard>
  );
}
