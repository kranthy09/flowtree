"use client";

import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";

// ── Chip / Badge ──────────────────────────────────────────────────────────────

interface ChipProps {
  /** Display text inside the badge. */
  label: string;
  /** Accent colour (hex/CSS). Drives text, tinted bg, and border. */
  color?: string;
  /** Use monospace font (paths, types, code). */
  mono?: boolean;
}

export function Chip({ label, color, mono }: ChipProps) {
  return (
    <span
      style={{
        display:      "inline-block",
        padding:      "1px 5px",
        borderRadius: "3px",
        fontSize:     "0.6rem",
        fontWeight:   600,
        fontFamily:   mono ? "monospace" : "inherit",
        lineHeight:   "1.5",
        color:        color ?? "var(--text-muted)",
        background:   color ? `${color}28` : "rgba(255,255,255,0.07)",
        border:       `1px solid ${color ? `${color}55` : "rgba(255,255,255,0.1)"}`,
        maxWidth:     "120px",
        overflow:     "hidden",
        textOverflow: "ellipsis",
        whiteSpace:   "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

interface NodeCardProps {
  /** Background colour of the header strip (use NODE_COLORS[type]). */
  bgColor: string;
  icon: string;
  label: string;
  name: string;
  selected: boolean;
  /** Render a target Handle at the top. Pass false for root API node. */
  hasTarget?: boolean;
  /** Small indicator rendered at the right of the header (e.g. execution status dot). */
  statusDot?: ReactNode;
  children?: ReactNode;
}

const BODY: CSSProperties = {
  padding:    "8px 10px",
  background: "var(--bg-surface)",
};

const NAME: CSSProperties = {
  fontWeight:   700,
  fontSize:     "0.8rem",
  color:        "var(--text-primary)",
  overflow:     "hidden",
  textOverflow: "ellipsis",
  whiteSpace:   "nowrap",
};

const SUB: CSSProperties = {
  marginTop:  "5px",
  display:    "flex",
  gap:        "4px",
  flexWrap:   "wrap",
  alignItems: "center",
};

const HEADER_TEXT: CSSProperties = {
  fontSize:      "0.6rem",
  fontWeight:    700,
  color:         "#fff",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export function NodeCard({
  bgColor,
  icon,
  label,
  name,
  selected,
  hasTarget = true,
  statusDot,
  children,
}: NodeCardProps) {
  return (
    <div
      style={{
        overflow:     "hidden",
        borderRadius: "8px",
        minWidth:     "180px",
        maxWidth:     "240px",
        fontFamily:   "sans-serif",
        border:       `2px solid ${selected ? "var(--primary)" : "rgba(255,255,255,0.08)"}`,
        boxShadow:    selected ? "0 0 0 2px var(--primary)" : "none",
      }}
    >
      {hasTarget && <Handle type="target" position={Position.Top} />}

      {/* ── Header ── */}
      <div
        style={{
          background:  bgColor,
          padding:     "5px 10px",
          display:     "flex",
          alignItems:  "center",
          gap:         "6px",
        }}
      >
        <span style={{ fontSize: "0.75rem" }}>{icon}</span>
        <span style={HEADER_TEXT}>{label}</span>
        {statusDot && <span style={{ marginLeft: "auto" }}>{statusDot}</span>}
      </div>

      {/* ── Body ── */}
      <div style={BODY}>
        <div style={NAME}>{name}</div>
        {children && <div style={SUB}>{children}</div>}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
