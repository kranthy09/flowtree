"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

function statusColor(code: number | null): string {
  if (!code) return "var(--text-muted)";
  if (code >= 500) return "#EF4444";
  if (code >= 400) return "#F59E0B";
  return "#22C55E";
}

export function ResponseNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node  = data.nodeResponse;
  const color = statusColor(node.status_code);

  return (
    <NodeCard
      bgColor={NODE_COLORS.response}
      icon={NODE_ICONS.response}
      label="Response"
      name={node.name}
      selected={!!selected}
    >
      {node.status_code && (
        <Chip label={String(node.status_code)} color={color} mono />
      )}
      {node.error_type && <Chip label={node.error_type} color="#EF4444" />}
    </NodeCard>
  );
}
