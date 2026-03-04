"use client";

import type { NodeProps } from "@xyflow/react";
import { NODE_COLORS, NODE_ICONS } from "@/lib/nodeTypes";
import type { FlowNodeData } from "@/lib/nodeTypes";
import { useCanvasStore } from "@/stores/canvasStore";
import type { CanvasState } from "@/stores/canvasStore";
import { Chip, NodeCard } from "./NodeCard";

const LANG_COLOR: Record<string, string> = {
  python:     "#3B82F6",
  javascript: "#F59E0B",
  typescript: "#3B82F6",
  sql:        "#A855F7",
  bash:       "#22C55E",
  shell:      "#22C55E",
};

// ── Execution status dot ──────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#F59E0B",
  RUNNING: "#3B82F6",
  SUCCESS: "#22C55E",
  ERROR:   "#EF4444",
  SKIPPED: "#6B7280",
};

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status.toUpperCase()] ?? "#6B7280";
  return (
    <span
      title={status}
      style={{
        display:      "inline-block",
        width:        "8px",
        height:       "8px",
        borderRadius: "50%",
        background:   color,
        boxShadow:    status.toUpperCase() === "RUNNING" ? `0 0 4px ${color}` : "none",
        flexShrink:   0,
      }}
    />
  );
}

// ── StepNode component ────────────────────────────────────────────────────────

export function StepNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const node   = data.nodeResponse;
  const lang   = (node.language ?? "").toLowerCase();
  const status = useCanvasStore((s: CanvasState) => s.nodeExecutionStatus[node.id]);

  // First non-empty line of code, truncated to 28 chars
  const firstLine = node.code
    ?.split("\n")
    .find((l) => l.trim().length > 0)
    ?.trim() ?? "";
  const codePreview = firstLine.length > 28 ? `${firstLine.slice(0, 28)}…` : firstLine;

  return (
    <NodeCard
      bgColor={NODE_COLORS.step}
      icon={NODE_ICONS.step}
      label="Step"
      name={node.name}
      selected={!!selected}
      statusDot={status ? <StatusDot status={status} /> : undefined}
    >
      {lang && <Chip label={lang} color={LANG_COLOR[lang]} />}
      {codePreview && <Chip label={codePreview} mono />}
    </NodeCard>
  );
}
