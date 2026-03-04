"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useWorkspaces,
  useCreateWorkspace,
  useRenameWorkspace,
  useDeleteWorkspace,
} from "@/hooks/useWorkspace";
import type { WorkspaceResponse } from "@/types/workspace";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── WorkspaceModal (create / rename) ─────────────────────────────────────────

function WorkspaceModal({
  title,
  initialName,
  initialDesc,
  submitLabel,
  busy,
  onSubmit,
  onClose,
}: {
  title:       string;
  initialName: string;
  initialDesc: string;
  submitLabel: string;
  busy:        boolean;
  onSubmit:    (name: string, description: string) => void;
  onClose:     () => void;
}) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDesc);

  return (
    <div
      onClick={onClose}
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
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem", padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onSubmit(name.trim(), desc);
                if (e.key === "Escape") onClose();
              }}
              placeholder="My API"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                padding: "7px 10px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="What does this API do?"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                padding: "7px 10px",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            style={{ padding: "6px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim(), desc)}
            disabled={!name.trim() || busy}
            style={{ padding: "6px 14px", background: "#22C55E", border: "1px solid #22C55E", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: name.trim() && !busy ? "pointer" : "not-allowed", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteDialog ──────────────────────────────────────────────────────────────

function DeleteDialog({
  name,
  busy,
  onConfirm,
  onClose,
}: {
  name:      string;
  busy:      boolean;
  onConfirm: () => void;
  onClose:   () => void;
}) {
  return (
    <div
      onClick={onClose}
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
          width: "380px",
          padding: "20px",
          display: "flex", flexDirection: "column", gap: "14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "0.925rem", color: "var(--text-primary)" }}>Delete workspace?</div>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-primary)" }}>"{name}"</strong> and all its nodes will be permanently deleted. This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "6px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ padding: "6px 14px", background: "var(--error)", border: "1px solid var(--error)", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DropdownItem ──────────────────────────────────────────────────────────────

function DropdownItem({
  label,
  icon,
  danger,
  onClick,
}: {
  label:   string;
  icon?:   string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "7px 12px",
        cursor: "pointer",
        color: danger ? "var(--error)" : "var(--text-primary)",
        background: hov ? "var(--bg-elevated)" : "transparent",
        fontSize: "0.8rem",
        userSelect: "none",
      }}
    >
      {icon && <span style={{ width: "14px", textAlign: "center" }}>{icon}</span>}
      <span>{label}</span>
    </div>
  );
}

// ── WorkspaceCard ─────────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  onOpen,
  onRename,
  onDelete,
}: {
  workspace: WorkspaceResponse;
  onOpen:    () => void;
  onRename:  () => void;
  onDelete:  () => void;
}) {
  const [hov, setHov]         = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    "var(--bg-surface)",
        border:        `1px solid ${hov ? "var(--primary, #6366f1)" : "var(--border)"}`,
        borderRadius:  "10px",
        padding:       "18px 18px 14px",
        cursor:        "pointer",
        display:       "flex",
        flexDirection: "column",
        gap:           "8px",
        transition:    "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow:     hov ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
        position:      "relative",
        userSelect:    "none",
      }}
    >
      {/* Name + ⋮ button */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: "0.925rem", color: "var(--text-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>
          {workspace.name}
        </span>
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            title="Options"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 6px", borderRadius: "4px", fontSize: "1.1rem", lineHeight: 1 }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position:     "absolute",
                top:          "calc(100% + 4px)",
                right:        0,
                background:   "var(--bg-surface)",
                border:       "1px solid var(--border)",
                borderRadius: "6px",
                boxShadow:    "0 4px 16px rgba(0,0,0,0.4)",
                minWidth:     "140px",
                zIndex:       20,
                overflow:     "hidden",
              }}
            >
              <DropdownItem icon="✎" label="Rename" onClick={() => { setMenuOpen(false); onRename(); }} />
              <DropdownItem icon="✕" label="Delete" danger onClick={() => { setMenuOpen(false); onDelete(); }} />
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          lineHeight: 1.55,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          minHeight: "2.4em",
        }}
      >
        {workspace.description || "No description"}
      </p>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "4px", gap: "8px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
        <span>{workspace.node_count} node{workspace.node_count !== 1 ? "s" : ""}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Updated {timeAgo(workspace.updated_at)}</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{
            padding:      "4px 12px",
            background:   hov ? "#22C55E" : "var(--bg-elevated)",
            border:       `1px solid ${hov ? "#22C55E" : "var(--border)"}`,
            borderRadius: "5px",
            color:        hov ? "#fff" : "var(--text-primary)",
            fontSize:     "0.72rem",
            fontWeight:   600,
            cursor:       "pointer",
            fontFamily:   "inherit",
            transition:   "all 0.15s ease",
          }}
        >
          Open →
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const { data: workspaces, isLoading }      = useWorkspaces();
  const { mutate: createWs, isPending: creating } = useCreateWorkspace();
  const { mutate: renameWs, isPending: renaming } = useRenameWorkspace();
  const { mutate: deleteWs, isPending: deleting } = useDeleteWorkspace();

  const [newModal, setNewModal]   = useState(false);
  const [renameTarget, setRenameTarget] = useState<WorkspaceResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceResponse | null>(null);
  const [search, setSearch]       = useState("");

  const filtered = (workspaces ?? []).filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleCreate(name: string, description: string) {
    createWs({ name, description }, {
      onSuccess: (ws) => {
        setNewModal(false);
        router.push(`/workspace/${ws.id}`);
      },
    });
  }

  function handleRename(name: string) {
    if (!renameTarget) return;
    renameWs({ id: renameTarget.id, data: { name } }, {
      onSuccess: () => setRenameTarget(null),
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteWs(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "sans-serif" }}>

      {/* ── Header ── */}
      <header
        style={{
          position:     "sticky",
          top:          0,
          background:   "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          padding:      "0 28px",
          height:       "60px",
          display:      "flex",
          alignItems:   "center",
          zIndex:       10,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          ⚡ FlowTree
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setNewModal(true)}
          style={{ padding: "7px 16px", background: "#22C55E", border: "1px solid #22C55E", borderRadius: "6px", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          + New Workspace
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth: "1120px", margin: "0 auto", padding: "36px 28px" }}>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workspaces…"
          style={{
            display: "block",
            width: "100%",
            maxWidth: "360px",
            marginBottom: "28px",
            padding: "8px 12px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Loading */}
        {isLoading && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading…</p>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "14px" }}>🌳</div>
            <p style={{ fontWeight: 600, fontSize: "0.925rem", color: "var(--text-primary)", margin: "0 0 6px" }}>
              {search ? "No workspaces match your search." : "No workspaces yet."}
            </p>
            <p style={{ fontSize: "0.8rem", margin: 0 }}>
              {search ? "Try a different search term." : "Create your first API tree to get started."}
            </p>
            {!search && (
              <button
                onClick={() => setNewModal(true)}
                style={{ marginTop: "20px", padding: "8px 18px", background: "#22C55E", border: "1px solid #22C55E", borderRadius: "6px", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                + New Workspace
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap:                 "16px",
            }}
          >
            {filtered.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onOpen={() => router.push(`/workspace/${ws.id}`)}
                onRename={() => setRenameTarget(ws)}
                onDelete={() => setDeleteTarget(ws)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {newModal && (
        <WorkspaceModal
          title="New Workspace"
          initialName=""
          initialDesc=""
          submitLabel="Create"
          busy={creating}
          onSubmit={handleCreate}
          onClose={() => setNewModal(false)}
        />
      )}

      {renameTarget && (
        <WorkspaceModal
          title="Rename Workspace"
          initialName={renameTarget.name}
          initialDesc={renameTarget.description ?? ""}
          submitLabel="Save"
          busy={renaming}
          onSubmit={(name) => handleRename(name)}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          busy={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
