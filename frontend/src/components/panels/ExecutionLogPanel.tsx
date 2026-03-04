"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore }              from "@/stores/canvasStore";
import { useRunDetail, useRuns }       from "@/hooks/useExecution";
import type { ExecutionDetail, RunSummary } from "@/types/execution";

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position:      "fixed",
  bottom:        0,
  left:          0,
  right:         0,
  height:        "240px",
  background:    "var(--bg-surface)",
  borderTop:     "1px solid var(--border)",
  display:       "flex",
  flexDirection: "column",
  zIndex:        10,
  fontFamily:    "sans-serif",
};

const HEADER: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  padding:      "6px 14px",
  borderBottom: "1px solid var(--border)",
  flexShrink:   0,
  gap:          "8px",
};

const TABLE: React.CSSProperties = {
  width:          "100%",
  borderCollapse: "collapse",
  fontSize:       "0.75rem",
  color:          "var(--text-primary)",
};

const TH: React.CSSProperties = {
  textAlign:    "left",
  padding:      "5px 10px",
  color:        "var(--text-muted)",
  fontWeight:   600,
  fontSize:     "0.65rem",
  borderBottom: "1px solid var(--border)",
  whiteSpace:   "nowrap",
};

const TD: React.CSSProperties = {
  padding:    "5px 10px",
  whiteSpace: "nowrap",
};

const BTN: React.CSSProperties = {
  padding:      "2px 8px",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.7rem",
  cursor:       "pointer",
};

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  completed: "#22C55E",
  running:   "#3B82F6",
  pending:   "#F59E0B",
  error:     "#EF4444",
  success:   "#22C55E",
  skipped:   "#6B7280",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status.toLowerCase()] ?? "#6B7280";
  return (
    <span
      style={{
        display:       "inline-block",
        padding:       "1px 6px",
        borderRadius:  "10px",
        fontSize:      "0.65rem",
        fontWeight:    700,
        color,
        background:    `${color}22`,
        border:        `1px solid ${color}55`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status}
    </span>
  );
}

// ── Run-detail modal ──────────────────────────────────────────────────────────

interface DetailModalProps {
  workspaceId: string;
  runId:       string;
  onClose:     () => void;
}

function DetailModal({ workspaceId, runId, onClose }: DetailModalProps) {
  const setNodeStatus = useCanvasStore((s) => s.setNodeExecutionStatus);
  const { data }      = useRunDetail(workspaceId, runId);

  // Sync per-node status into canvas store so StepNodes show status dots.
  const prevRef = useRef("");
  useEffect(() => {
    if (!data) return;
    const key = data.executions.map((e) => `${e.node_id}:${e.status}`).join(",");
    if (key === prevRef.current) return;
    prevRef.current = key;
    const map: Record<string, string> = {};
    for (const exec of data.executions) map[exec.node_id] = exec.status;
    setNodeStatus(map);
  }, [data, setNodeStatus]);

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0,0,0,0.55)",
        zIndex:         50,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    "var(--bg-surface)",
          border:        "1px solid var(--border)",
          borderRadius:  "8px",
          width:         "640px",
          maxHeight:     "70vh",
          overflow:      "hidden",
          display:       "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            padding:      "10px 14px",
            borderBottom: "1px solid var(--border)",
            gap:          "8px",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", flex: 1 }}>
            Run — {runId.slice(0, 8)}…
          </span>
          {data && <StatusBadge status={data.status} />}
          <button style={BTN} onClick={onClose}>× Close</button>
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          {!data ? (
            <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading…</p>
          ) : (
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Node</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Duration</th>
                  <th style={TH}>Error</th>
                </tr>
              </thead>
              <tbody>
                {data.executions.map((exec: ExecutionDetail) => (
                  <tr key={exec.node_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={TD}>{exec.node_name}</td>
                    <td style={TD}><StatusBadge status={exec.status} /></td>
                    <td style={{ ...TD, color: "var(--text-muted)" }}>
                      {exec.duration_ms != null ? `${exec.duration_ms} ms` : "—"}
                    </td>
                    <td style={{ ...TD, color: "var(--error)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {exec.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ExecutionLogPanelProps {
  workspaceId: string;
}

export function ExecutionLogPanel({ workspaceId }: ExecutionLogPanelProps) {
  const open          = useCanvasStore((s) => s.executionLogOpen);
  const setOpen       = useCanvasStore((s) => s.setExecutionLogOpen);
  const setNodeStatus = useCanvasStore((s) => s.setNodeExecutionStatus);

  const { data: runs }      = useRuns(workspaceId);
  const [viewRunId, setViewRunId] = useState<string | null>(null);

  // Clear status dots when panel is closed.
  useEffect(() => {
    if (!open) setNodeStatus({});
  }, [open, setNodeStatus]);

  if (!open) return null;

  return (
    <>
      <div style={PANEL}>
        <div style={HEADER}>
          <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-primary)" }}>
            Execution Log
          </span>
          <span style={{ flex: 1 }} />
          <button style={BTN} onClick={() => setOpen(false)}>× Close</button>
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          {!runs || runs.length === 0 ? (
            <p style={{ padding: "16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              No runs yet — click ▶ Run to execute the pipeline.
            </p>
          ) : (
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Run ID</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Started</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run: RunSummary) => (
                  <tr key={run.run_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...TD, fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {run.run_id.slice(0, 8)}…
                    </td>
                    <td style={TD}><StatusBadge status={run.status} /></td>
                    <td style={{ ...TD, color: "var(--text-muted)" }}>
                      {new Date(run.created_at).toLocaleTimeString()}
                    </td>
                    <td style={TD}>
                      <button style={BTN} onClick={() => setViewRunId(run.run_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewRunId && (
        <DetailModal
          workspaceId={workspaceId}
          runId={viewRunId}
          onClose={() => setViewRunId(null)}
        />
      )}
    </>
  );
}
