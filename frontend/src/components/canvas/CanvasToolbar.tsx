"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient }             from "@tanstack/react-query";
import { useCanvasStore }             from "@/stores/canvasStore";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspace";
import { useNodes }                   from "@/hooks/useNodes";
import { nodesQueryKey }              from "@/hooks/useNodes";
import { validateTree }               from "@/lib/treeUtils";
import { computeDagreLayout }         from "@/lib/layoutUtils";
import { importOpenApi, updateNode }  from "@/lib/api";
import { RunModal }                   from "@/components/canvas/RunTrigger";

// ── Styles ─────────────────────────────────────────────────────────────────────

const TOOLBAR: React.CSSProperties = {
  position:     "fixed",
  top:          0,
  left:         0,
  right:        0,
  height:       "48px",
  background:   "var(--bg-surface)",
  borderBottom: "1px solid var(--border)",
  display:      "flex",
  alignItems:   "center",
  zIndex:       20,
  fontFamily:   "sans-serif",
  padding:      "0 12px",
  gap:          "8px",
};

const BTN: React.CSSProperties = {
  padding:      "5px 11px",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "5px",
  color:        "var(--text-primary)",
  fontSize:     "0.75rem",
  cursor:       "pointer",
  fontFamily:   "inherit",
  whiteSpace:   "nowrap",
  flexShrink:   0,
};

const PRIMARY_BTN: React.CSSProperties = {
  ...BTN,
  background: "#22C55E",
  border:     "1px solid #22C55E",
  color:      "#fff",
  fontWeight: 700,
};

const DIVIDER: React.CSSProperties = {
  width:      "1px",
  height:     "20px",
  background: "var(--border)",
  flexShrink: 0,
};

const NAME_INPUT: React.CSSProperties = {
  background:   "transparent",
  border:       "1px solid transparent",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.875rem",
  fontWeight:   700,
  fontFamily:   "inherit",
  padding:      "3px 6px",
  minWidth:     "120px",
  maxWidth:     "220px",
  outline:      "none",
};

// ── Validate dropdown ─────────────────────────────────────────────────────────

function ValidateDropdown({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function down(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position:     "absolute",
        top:          "48px",
        left:         "50%",
        transform:    "translateX(-50%)",
        background:   "var(--bg-surface)",
        border:       "1px solid var(--border)",
        borderRadius: "6px",
        boxShadow:    "0 4px 16px rgba(0,0,0,0.4)",
        minWidth:     "280px",
        maxWidth:     "420px",
        zIndex:       30,
        overflow:     "hidden",
        fontFamily:   "sans-serif",
      }}
    >
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>
          {errors.length === 0 ? "✓ Tree is valid" : `${errors.length} issue${errors.length > 1 ? "s" : ""} found`}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px" }}
        >
          ×
        </button>
      </div>
      {errors.length > 0 && (
        <ul style={{ margin: 0, padding: "8px 12px 8px 28px", listStyle: "disc" }}>
          {errors.map((e, i) => (
            <li key={i} style={{ fontSize: "0.75rem", color: "var(--error)", marginBottom: "4px" }}>
              {e}
            </li>
          ))}
        </ul>
      )}
      {errors.length === 0 && (
        <p style={{ margin: 0, padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          All structural checks passed.
        </p>
      )}
    </div>
  );
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

interface CanvasToolbarProps {
  workspaceId: string;
}

export function CanvasToolbar({ workspaceId }: CanvasToolbarProps) {
  const openPanel        = useCanvasStore((s) => s.openPanel);
  const setRunModalOpen  = useCanvasStore((s) => s.setRunModalOpen);
  const runModalOpen     = useCanvasStore((s) => s.runModalOpen);
  const setFitToNodeId   = useCanvasStore((s) => s.setFitToNodeId);
  const saveSignal       = useCanvasStore((s) => s.saveSignal);

  const { data: workspace }                = useWorkspace(workspaceId);
  const { mutate: saveWorkspace }          = useUpdateWorkspace(workspaceId);
  const { data: allNodes }                 = useNodes(workspaceId);
  const queryClient                        = useQueryClient();

  // ── Workspace name (inline edit) ──────────────────────────────────────────
  const [nameValue, setNameValue]   = useState("");
  const [lastSaved, setLastSaved]   = useState<Date | null>(null);
  const [savedLabel, setSavedLabel] = useState("");

  // Sync fetched name → input once
  useEffect(() => {
    if (workspace?.name && !nameValue) setNameValue(workspace.name);
  }, [workspace?.name, nameValue]);

  // "Saved X ago" ticker
  useEffect(() => {
    if (!lastSaved) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (secs < 60) setSavedLabel(`Saved ${secs}s ago`);
      else setSavedLabel(`Saved ${Math.floor(secs / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [lastSaved]);

  const handleSave = useCallback(() => {
    if (!nameValue.trim()) return;
    saveWorkspace({ name: nameValue.trim() }, {
      onSuccess: () => setLastSaved(new Date()),
    });
  }, [nameValue, saveWorkspace]);

  // Ctrl+S keyboard shortcut — FlowCanvas increments saveSignal; watch it here.
  const prevSaveSignal = useRef(saveSignal);
  useEffect(() => {
    if (saveSignal === 0 || saveSignal === prevSaveSignal.current) return;
    prevSaveSignal.current = saveSignal;
    handleSave();
  }, [saveSignal, handleSave]);

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.currentTarget.blur(); handleSave(); }
    if (e.key === "Escape") {
      setNameValue(workspace?.name ?? "");
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const [validateOpen, setValidateOpen] = useState(false);
  const [validateErrors, setValidateErrors] = useState<string[]>([]);

  function handleValidate() {
    const nodes = allNodes ?? [];
    const errors = validateTree(nodes);
    setValidateErrors(errors);
    setValidateOpen(true);
  }

  // ── Import ────────────────────────────────────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMerge, setImportMerge]         = useState(true);
  const [importBusy, setImportBusy]           = useState(false);
  const [importError, setImportError]         = useState<string | null>(null);
  const [importResult, setImportResult]       = useState<string | null>(null);
  const fileInputRef                          = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    e.target.value = ""; // reset so same file can be re-selected
    setImportError(null);
    setImportResult(null);
    setImportBusy(true);
    try {
      const res = await importOpenApi(workspaceId, content, importMerge);
      setImportResult(`Imported ${res.count} nodes.`);
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey(workspaceId) });
      setTimeout(() => setFitToNodeId("__ALL__"), 400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setImportError(msg);
    } finally {
      setImportBusy(false);
    }
  }

  // ── Auto Layout ───────────────────────────────────────────────────────────
  const [layoutBusy, setLayoutBusy] = useState(false);

  async function handleAutoLayout() {
    const nodes = allNodes ?? [];
    if (nodes.length === 0) return;
    setLayoutBusy(true);
    try {
      const positions = computeDagreLayout(nodes);
      await Promise.all(
        nodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return Promise.resolve();
          return updateNode(workspaceId, n.id, { position_x: pos.x, position_y: pos.y });
        }),
      );
      await queryClient.invalidateQueries({ queryKey: nodesQueryKey(workspaceId) });
      // Give React time to re-render before fitting
      setTimeout(() => setFitToNodeId("__ALL__"), 400);
    } finally {
      setLayoutBusy(false);
    }
  }

  return (
    <>
      {/* ── Toolbar strip ── */}
      <div style={TOOLBAR}>

        {/* Left: workspace name */}
        <input
          style={NAME_INPUT}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleNameKeyDown}
          onFocus={(e) => (e.target.style.borderColor = "var(--border)")}
          placeholder="Workspace name"
          aria-label="Workspace name"
        />

        <span style={DIVIDER} />

        {/* Center: action buttons */}
        <button style={PRIMARY_BTN} onClick={() => setRunModalOpen(true)}>
          ▶ Run
        </button>

        <div style={{ position: "relative" }}>
          <button
            style={BTN}
            onClick={handleValidate}
          >
            ✓ Validate
          </button>
          {validateOpen && (
            <ValidateDropdown
              errors={validateErrors}
              onClose={() => setValidateOpen(false)}
            />
          )}
        </div>

        <button
          style={{ ...BTN, opacity: layoutBusy ? 0.6 : 1 }}
          onClick={handleAutoLayout}
          disabled={layoutBusy}
        >
          {layoutBusy ? "Laying out…" : "⊞ Auto Layout"}
        </button>

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Right: import, export, save, timestamp */}
        <button style={BTN} onClick={() => setImportModalOpen(true)}>
          ↙ Import
        </button>

        <button style={BTN} onClick={() => openPanel("export")}>
          ↗ Export
        </button>

        <span style={DIVIDER} />

        <button style={BTN} onClick={handleSave}>
          Save
        </button>

        {savedLabel && (
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {savedLabel}
          </span>
        )}
      </div>

      {/* Hidden file input for OpenAPI import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      {/* Import modal */}
      {importModalOpen && (
        <div
          onClick={() => { setImportModalOpen(false); setImportError(null); setImportResult(null); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              width: "420px",
              display: "flex", flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", flex: 1 }}>
                Import OpenAPI Spec
              </span>
              <button
                onClick={() => { setImportModalOpen(false); setImportError(null); setImportResult(null); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
                Upload a JSON or YAML OpenAPI 3.0 file. FlowTree will create API Root,
                Endpoint, Request, Response, Field and Model nodes automatically.
              </p>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={importMerge}
                  onChange={(e) => setImportMerge(e.target.checked)}
                  style={{ width: "14px", height: "14px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                  Merge with existing nodes
                  <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>
                    (uncheck to replace all)
                  </span>
                </span>
              </label>

              {importError && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--error)", background: "rgba(239,68,68,0.08)", padding: "8px 10px", borderRadius: "5px" }}>
                  {importError}
                </p>
              )}
              {importResult && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#22C55E", background: "rgba(34,197,94,0.08)", padding: "8px 10px", borderRadius: "5px" }}>
                  ✓ {importResult}
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => { setImportModalOpen(false); setImportError(null); setImportResult(null); }}
                style={{ padding: "6px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Close
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
                style={{ padding: "6px 14px", background: "var(--primary, #6366f1)", border: "1px solid var(--primary, #6366f1)", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: importBusy ? "not-allowed" : "pointer", opacity: importBusy ? 0.6 : 1, fontFamily: "inherit" }}
              >
                {importBusy ? "Importing…" : "↙ Choose File"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run modal — shared with floating RunTrigger via canvasStore */}
      {runModalOpen && (
        <RunModal workspaceId={workspaceId} onClose={() => setRunModalOpen(false)} />
      )}
    </>
  );
}
