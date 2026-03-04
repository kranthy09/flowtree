"use client";

import { useState } from "react";
import { useCanvasStore }  from "@/stores/canvasStore";
import { useRunPipeline }  from "@/hooks/useExecution";

// ── Styles ────────────────────────────────────────────────────────────────────

const FLOAT_BTN: React.CSSProperties = {
  position:     "fixed",
  bottom:       "24px",
  right:        "24px",
  padding:      "10px 18px",
  background:   "#22C55E",
  color:        "#fff",
  border:       "none",
  borderRadius: "8px",
  fontWeight:   700,
  fontSize:     "0.875rem",
  cursor:       "pointer",
  boxShadow:    "0 4px 12px rgba(34,197,94,0.4)",
  zIndex:       20,
  display:      "flex",
  alignItems:   "center",
  gap:          "6px",
};

const OVERLAY: React.CSSProperties = {
  position:       "fixed",
  inset:          0,
  background:     "rgba(0,0,0,0.55)",
  zIndex:         50,
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
};

const MODAL: React.CSSProperties = {
  background:    "var(--bg-surface)",
  border:        "1px solid var(--border)",
  borderRadius:  "10px",
  width:         "480px",
  display:       "flex",
  flexDirection: "column",
  fontFamily:    "sans-serif",
};

const MODAL_HEADER: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  padding:      "12px 16px",
  borderBottom: "1px solid var(--border)",
  gap:          "8px",
};

const MODAL_BODY: React.CSSProperties = {
  padding:       "16px",
  display:       "flex",
  flexDirection: "column",
  gap:           "10px",
};

const MODAL_FOOTER: React.CSSProperties = {
  display:        "flex",
  justifyContent: "flex-end",
  gap:            "8px",
  padding:        "12px 16px",
  borderTop:      "1px solid var(--border)",
};

const BTN: React.CSSProperties = {
  padding:      "6px 14px",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "6px",
  color:        "var(--text-primary)",
  fontSize:     "0.8rem",
  cursor:       "pointer",
};

const PRIMARY_BTN: React.CSSProperties = {
  ...BTN,
  background: "#22C55E",
  border:     "1px solid #22C55E",
  color:      "#fff",
  fontWeight: 700,
};

const TEXTAREA: React.CSSProperties = {
  width:      "100%",
  height:     "140px",
  background: "var(--bg-elevated)",
  border:     "1px solid var(--border)",
  borderRadius: "6px",
  color:      "var(--text-primary)",
  fontFamily: "monospace",
  fontSize:   "0.8rem",
  padding:    "8px 10px",
  resize:     "vertical",
  boxSizing:  "border-box",
};

// ── RunModal — exported so CanvasToolbar can reference the same modal ─────────

interface RunModalProps {
  workspaceId: string;
  onClose:     () => void;
}

export function RunModal({ workspaceId, onClose }: RunModalProps) {
  const setExecutionLogOpen               = useCanvasStore((s) => s.setExecutionLogOpen);
  const { mutate, isPending, isError, error } = useRunPipeline(workspaceId);
  const [ctx, setCtx]     = useState("{}");
  const [parseErr, setParseErr] = useState<string | null>(null);

  function handleRun() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(ctx) as Record<string, unknown>;
    } catch {
      setParseErr("Invalid JSON — fix the context before running.");
      return;
    }
    setParseErr(null);
    mutate(parsed, {
      onSuccess: () => {
        setExecutionLogOpen(true);
        onClose();
      },
    });
  }

  const errMsg =
    parseErr ??
    (isError && error instanceof Error ? error.message : isError ? "Run failed." : null);

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <div style={MODAL_HEADER}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", flex: 1 }}>
            Run Pipeline
          </span>
          <button style={{ ...BTN, padding: "2px 6px" }} onClick={onClose}>×</button>
        </div>

        <div style={MODAL_BODY}>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Initial context (JSON)
          </label>
          <textarea
            style={TEXTAREA}
            value={ctx}
            onChange={(e) => setCtx(e.target.value)}
            spellCheck={false}
          />
          {errMsg && (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--error)" }}>{errMsg}</p>
          )}
        </div>

        <div style={MODAL_FOOTER}>
          <button style={BTN} onClick={onClose}>Cancel</button>
          <button style={PRIMARY_BTN} onClick={handleRun} disabled={isPending}>
            {isPending ? "Running…" : "▶ Run"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Floating trigger button ───────────────────────────────────────────────────
// The modal open state lives in canvasStore so the toolbar Run button can
// open the same modal without prop-drilling.

interface RunTriggerProps {
  workspaceId: string;
}

export function RunTrigger({ workspaceId }: RunTriggerProps) {
  const runModalOpen   = useCanvasStore((s) => s.runModalOpen);
  const setRunModalOpen = useCanvasStore((s) => s.setRunModalOpen);

  return (
    <>
      <button style={FLOAT_BTN} onClick={() => setRunModalOpen(true)}>
        ▶ Run
      </button>
      {runModalOpen && (
        <RunModal workspaceId={workspaceId} onClose={() => setRunModalOpen(false)} />
      )}
    </>
  );
}
