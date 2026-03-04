"use client";

import { useCallback, useEffect, useState } from "react";
import { useCanvasStore }   from "@/stores/canvasStore";
import { useNodes }         from "@/hooks/useNodes";
import { useExportOpenApi, useExportPrompt, useExportSchema } from "@/hooks/useExport";
import { CodeEditor }       from "@/components/ui/CodeEditor";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "openapi" | "schema" | "prompt";

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position:      "fixed",
  top:           "48px",
  right:         0,
  width:         "480px",
  height:        "calc(100vh - 48px)",
  background:    "var(--bg-surface)",
  borderLeft:    "1px solid var(--border)",
  display:       "flex",
  flexDirection: "column",
  zIndex:        10,
  fontFamily:    "sans-serif",
};

const HEADER: React.CSSProperties = {
  display:      "flex",
  alignItems:   "center",
  padding:      "12px 14px",
  borderBottom: "1px solid var(--border)",
  flexShrink:   0,
  gap:          "8px",
};

const TAB_BAR: React.CSSProperties = {
  display:      "flex",
  borderBottom: "1px solid var(--border)",
  flexShrink:   0,
};

const ACTION_BAR: React.CSSProperties = {
  display:      "flex",
  gap:          "8px",
  padding:      "8px 12px",
  borderBottom: "1px solid var(--border)",
  flexShrink:   0,
  alignItems:   "center",
};

const EDITOR_WRAP: React.CSSProperties = {
  flex:     1,
  overflow: "hidden",
  display:  "flex",
  flexDirection: "column",
};

// ── Small button styles ───────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  padding:      "4px 10px",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.75rem",
  cursor:       "pointer",
};

const ACTIVE_BTN: React.CSSProperties = {
  ...BTN,
  background: "var(--primary)",
  border:     "1px solid var(--primary)",
  color:      "#fff",
};

const CLOSE_BTN: React.CSSProperties = {
  background:   "none",
  border:       "none",
  color:        "var(--text-muted)",
  cursor:       "pointer",
  fontSize:     "1.1rem",
  lineHeight:   1,
  padding:      "2px 4px",
  borderRadius: "4px",
  marginLeft:   "auto",
};

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex:         1,
        padding:      "8px 4px",
        background:   "none",
        border:       "none",
        borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
        color:        active ? "var(--text-primary)" : "var(--text-muted)",
        fontSize:     "0.75rem",
        fontWeight:   active ? 700 : 400,
        cursor:       "pointer",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

// ── Loading / Error states ────────────────────────────────────────────────────

function Loading() {
  return (
    <div
      style={{
        flex:            1,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        color:           "var(--text-muted)",
        fontSize:        "0.8rem",
      }}
    >
      Generating export…
    </div>
  );
}

function ExportError({ message }: { message: string }) {
  return (
    <div
      style={{
        margin:       "12px",
        padding:      "12px",
        background:   "rgba(239,68,68,0.1)",
        border:       "1px solid var(--error)",
        borderRadius: "6px",
        color:        "var(--error)",
        fontSize:     "0.8rem",
      }}
    >
      {message}
    </div>
  );
}

// ── Copy / Download helpers ───────────────────────────────────────────────────

function copyToClipboard(content: string, onDone: () => void) {
  navigator.clipboard.writeText(content).then(onDone).catch(() => undefined);
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tab content components (mount lazily — only when tab is active) ───────────

function OpenApiTab({ workspaceId }: { workspaceId: string }) {
  const [fmt, setFmt]         = useState<"json" | "yaml">("json");
  const [copied, setCopied]   = useState(false);
  const { data, isLoading, isError, refetch } = useExportOpenApi(workspaceId, fmt);

  function handleCopy() {
    if (!data) return;
    copyToClipboard(data.content, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <>
      <div style={ACTION_BAR}>
        {/* JSON / YAML toggle */}
        <button style={fmt === "json" ? ACTIVE_BTN : BTN} onClick={() => setFmt("json")}>JSON</button>
        <button style={fmt === "yaml" ? ACTIVE_BTN : BTN} onClick={() => setFmt("yaml")}>YAML</button>
        <span style={{ flex: 1 }} />
        <button style={BTN} onClick={() => refetch()}>↺ Refresh</button>
        <button style={BTN} onClick={handleCopy}>{copied ? "Copied ✓" : "Copy"}</button>
        {data && (
          <button style={BTN} onClick={() => downloadFile(data.content, data.filename)}>Download</button>
        )}
      </div>
      {isLoading && <Loading />}
      {isError   && (
        <ExportError message="Export failed — make sure your tree has an API root node with at least one endpoint." />
      )}
      {data && !isLoading && (
        <div style={EDITOR_WRAP}>
          <CodeEditor
            label=""
            value={data.content}
            language={fmt === "yaml" ? "yaml" : "json"}
            height="100%"
            readOnly
          />
        </div>
      )}
    </>
  );
}

function SchemaTab({ workspaceId, modelNodes }: { workspaceId: string; modelNodes: string[] }) {
  const [modelName, setModelName] = useState<string | null>(modelNodes[0] ?? null);
  const [copied, setCopied]       = useState(false);
  const { data, isLoading, isError, refetch } = useExportSchema(workspaceId, modelName);

  function handleCopy() {
    if (!data) return;
    copyToClipboard(data.content, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <>
      <div style={ACTION_BAR}>
        <select
          value={modelName ?? ""}
          onChange={(e) => setModelName(e.target.value || null)}
          style={{
            background:   "var(--bg-elevated)",
            border:       "1px solid var(--border)",
            borderRadius: "4px",
            color:        "var(--text-primary)",
            fontSize:     "0.75rem",
            padding:      "4px 6px",
            flex:         1,
          }}
        >
          <option value="">— first request body —</option>
          {modelNodes.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button style={BTN} onClick={() => refetch()}>↺ Refresh</button>
        <button style={BTN} onClick={handleCopy}>{copied ? "Copied ✓" : "Copy"}</button>
        {data && (
          <button style={BTN} onClick={() => downloadFile(data.content, data.filename)}>Download</button>
        )}
      </div>
      {isLoading && <Loading />}
      {isError   && (
        <ExportError message="Schema export failed — add at least one MODEL or REQUEST node." />
      )}
      {data && !isLoading && (
        <div style={EDITOR_WRAP}>
          <CodeEditor
            label=""
            value={data.content}
            language="json"
            height="100%"
            readOnly
          />
        </div>
      )}
    </>
  );
}

function PromptTab({ workspaceId }: { workspaceId: string }) {
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError, refetch } = useExportPrompt(workspaceId);

  function handleCopy() {
    if (!data) return;
    copyToClipboard(data.content, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <>
      <div style={ACTION_BAR}>
        <button style={BTN} onClick={() => refetch()}>↺ Refresh</button>
        <button style={BTN} onClick={handleCopy}>{copied ? "Copied ✓" : "Copy"}</button>
        {data && (
          <button style={BTN} onClick={() => downloadFile(data.content, data.filename)}>Download</button>
        )}
      </div>
      {isLoading && <Loading />}
      {isError   && (
        <ExportError message="Prompt export failed — make sure your tree has at least one endpoint." />
      )}
      {data && !isLoading && (
        <div style={EDITOR_WRAP}>
          <CodeEditor
            label=""
            value={data.content}
            language="markdown"
            height="100%"
            readOnly
          />
        </div>
      )}
    </>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ExportPanelProps {
  workspaceId: string;
}

export function ExportPanel({ workspaceId }: ExportPanelProps) {
  const panelOpen  = useCanvasStore((s) => s.panelOpen);
  const closePanel = useCanvasStore((s) => s.closePanel);
  const [activeTab, setActiveTab] = useState<Tab>("openapi");

  const { data: allNodes } = useNodes(workspaceId);
  const modelNodes = (allNodes ?? [])
    .filter((n) => n.node_type === "model")
    .map((n) => n.name);

  // Escape key closes panel
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") closePanel();
  }, [closePanel]);

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  if (panelOpen !== "export") return null;

  return (
    <div style={PANEL}>
      {/* ── Header ── */}
      <div style={HEADER}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
          Export
        </span>
        <button style={CLOSE_BTN} onClick={closePanel} title="Close (Esc)">×</button>
      </div>

      {/* ── Tab bar ── */}
      <div style={TAB_BAR}>
        <TabBtn label="OpenAPI"      active={activeTab === "openapi"} onClick={() => setActiveTab("openapi")} />
        <TabBtn label="JSON Schema"  active={activeTab === "schema"}  onClick={() => setActiveTab("schema")} />
        <TabBtn label="Agent Prompt" active={activeTab === "prompt"}  onClick={() => setActiveTab("prompt")} />
      </div>

      {/* ── Tab content (lazy mount — only mounts when active) ── */}
      {activeTab === "openapi" && <OpenApiTab workspaceId={workspaceId} />}
      {activeTab === "schema"  && <SchemaTab  workspaceId={workspaceId} modelNodes={modelNodes} />}
      {activeTab === "prompt"  && <PromptTab  workspaceId={workspaceId} />}
    </div>
  );
}
