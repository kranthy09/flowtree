"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { Chip, NodeCard } from "./NodeCard";

export function FieldNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node = data.nodeResponse;

  // e.g. "string (email)" or just "integer"
  const typeLabel = node.field_format
    ? `${node.field_type ?? "string"} (${node.field_format})`
    : (node.field_type ?? "string");

  // Suffix ? for optional fields
  const displayName = node.required ? node.name : `${node.name}?`;

  return (
    <NodeCard
      bgColor={NODE_COLORS.field}
      icon={NODE_ICONS.field}
      label="Field"
      name={displayName}
      selected={!!selected}
    >
      <Chip label={typeLabel} mono />
      {node.nullable && <Chip label="nullable" />}
    </NodeCard>
  );
}
