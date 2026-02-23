/**
 * NodeDetailPanel — slide-up panel for editing all node fields.
 *
 * Sections:
 *   1. Identity       — node_role, description
 *   2. Flow Control   — branch_condition, http_status_code, error_type
 *   3. Business Logic — service_method, external_api_call, condition,
 *                       database_query, input_schema, output_schema
 *   4. Exec Config    — retry_count, timeout_ms, sla_ms, is_async
 *   5. Documentation  — owner_team
 *
 * Props: { node, onSave, onClose }
 */
import { useState, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_ROLE_OPTIONS = [
  "start", "process", "decision", "terminal", "error",
];
const BRANCH_CONDITION_OPTIONS = ["always", "success", "failure"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toJsonString(value) {
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function initDraft(node) {
  return {
    // Section 1
    node_role:         node.node_role         ?? "",
    description:       node.description       ?? "",
    // Section 2
    branch_condition:  node.branch_condition  ?? "",
    http_status_code:  node.http_status_code  != null
      ? String(node.http_status_code) : "",
    error_type:        node.error_type        ?? "",
    // Section 3
    service_method:    node.service_method    ?? "",
    external_api_call: node.external_api_call ?? "",
    condition:         node.condition         ?? "",
    database_query:    node.database_query    ?? "",
    input_schema:      toJsonString(node.input_schema),
    output_schema:     toJsonString(node.output_schema),
    // Section 4
    retry_count:       node.retry_count != null ? String(node.retry_count) : "0",
    timeout_ms:        node.timeout_ms  != null ? String(node.timeout_ms)  : "",
    sla_ms:            node.sla_ms      != null ? String(node.sla_ms)      : "",
    is_async:          node.is_async    ?? false,
    // Section 5
    owner_team:        node.owner_team  ?? "",
  };
}

function buildPatch(draft, node) {
  const patch = {};

  // Text / select fields → null when empty
  const textKeys = [
    "node_role", "description", "branch_condition", "error_type",
    "service_method", "external_api_call", "condition",
    "database_query", "owner_team",
  ];
  for (const key of textKeys) {
    const newVal = (draft[key] ?? "").trim() || null;
    const oldVal = node[key] ?? null;
    if (newVal !== oldVal) patch[key] = newVal;
  }

  // Nullable integer fields
  for (const key of ["http_status_code", "timeout_ms", "sla_ms"]) {
    const raw = (draft[key] ?? "").trim();
    const newVal = raw ? parseInt(raw, 10) : null;
    const oldVal = node[key] ?? null;
    if (newVal !== oldVal) patch[key] = newVal;
  }

  // retry_count: integer, defaults to 0
  const newRetry = parseInt(draft.retry_count || "0", 10);
  if (newRetry !== (node.retry_count ?? 0)) patch.retry_count = newRetry;

  // is_async: boolean
  if ((draft.is_async ?? false) !== (node.is_async ?? false)) {
    patch.is_async = draft.is_async;
  }

  // JSON fields
  for (const key of ["input_schema", "output_schema"]) {
    const raw = (draft[key] ?? "").trim();
    const newVal = raw ? JSON.parse(raw) : null;
    if (toJsonString(newVal) !== toJsonString(node[key])) {
      patch[key] = newVal;
    }
  }

  return patch;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <div className="col-span-full mt-4">
      <span className="block text-[9px] uppercase tracking-widest
                       text-indigo-500/70 font-semibold border-b
                       border-indigo-900/40 pb-0.5 select-none">
        {title}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NodeDetailPanel({ node, onSave, onClose }) {
  const [draft, setDraft] = useState({});
  const [jsonErrors, setJsonErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!node) return;
    setDraft(initDraft(node));
    setJsonErrors({});
    setSaveError("");
  }, [node]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!node) return null;

  const handleChange = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "input_schema" || key === "output_schema") {
      setJsonErrors((e) => ({ ...e, [key]: null }));
    }
  };

  const handleSave = async () => {
    // Validate JSON fields
    const errors = {};
    let hasError = false;
    for (const key of ["input_schema", "output_schema"]) {
      const raw = (draft[key] ?? "").trim();
      if (raw) {
        try { JSON.parse(raw); }
        catch {
          errors[key] = `Invalid JSON in ${key}`;
          hasError = true;
        }
      }
    }
    if (hasError) { setJsonErrors(errors); return; }

    const patch = buildPatch(draft, node);
    if (Object.keys(patch).length === 0) { onClose(); return; }

    setSaving(true);
    setSaveError("");
    try {
      await onSave(node.id, patch);
      onClose();
    } catch (err) {
      setSaveError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inp =
    "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 " +
    "text-xs text-gray-100 placeholder-gray-500 focus:outline-none " +
    "focus:border-indigo-500 resize-none";

  // Renders a single labelled field in the grid
  const F = ({ id, label, kind, placeholder, options, min, max, span2 }) => {
    const hasError = !!jsonErrors[id];
    const cls = inp + (hasError ? " border-red-500" : "");
    return (
      <div className={span2 ? "sm:col-span-2" : ""}>
        <label className="block text-[10px] uppercase tracking-wider
                          text-gray-500 mb-1 select-none">
          {label}
        </label>
        {kind === "select" ? (
          <select
            className={cls}
            value={draft[id] ?? ""}
            onChange={(e) => handleChange(id, e.target.value)}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : kind === "number" ? (
          <input
            type="number"
            className={cls}
            value={draft[id] ?? ""}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
          />
        ) : kind === "textarea" ? (
          <textarea
            className={cls + " font-mono"}
            rows={3}
            value={draft[id] ?? ""}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={placeholder}
          />
        ) : kind === "json" ? (
          <>
            <textarea
              className={cls + " font-mono"}
              rows={4}
              value={draft[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              placeholder='{"key": "value"}'
            />
            {hasError && (
              <p className="text-red-400 text-[10px] mt-0.5">
                {jsonErrors[id]}
              </p>
            )}
          </>
        ) : (
          <input
            type="text"
            className={cls}
            value={draft[id] ?? ""}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-stretch"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full border-t border-gray-700 shadow-2xl z-50 flex flex-col"
        style={{ backgroundColor: "#111827", maxHeight: "70vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-2.5
                        border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 select-none">
              Node Detail
            </span>
            <span className="text-sm font-semibold text-indigo-300">
              #{node.id}{node.name ? ` · ${node.name}` : ""}
            </span>
            {node.type && (
              <span className="text-[10px] px-1.5 py-px rounded
                               bg-gray-700 text-gray-400">
                {node.type}
              </span>
            )}
            {node.node_role && (
              <span className="text-[10px] px-1.5 py-px rounded
                               bg-indigo-900/40 text-indigo-300">
                {node.node_role}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg leading-none px-1"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">

            {/* 1. Identity */}
            <SectionHeader title="Identity" />
            <F id="node_role" label="Node Role" kind="select"
               placeholder="(none)" options={NODE_ROLE_OPTIONS} />
            <F id="description" label="Description" kind="textarea"
               placeholder="Describe what this node does…" />

            {/* 2. Flow Control */}
            <SectionHeader title="Flow Control" />
            <F id="branch_condition" label="Branch Condition" kind="select"
               placeholder="(inherit always)"
               options={BRANCH_CONDITION_OPTIONS} />
            <F id="http_status_code" label="HTTP Status Code" kind="number"
               placeholder="200, 400, 422…" min={100} max={599} />
            <F id="error_type" label="Error Type" kind="text"
               placeholder="UNAUTHORIZED, NOT_FOUND…" />

            {/* 3. Business Logic */}
            <SectionHeader title="Business Logic" />
            <F id="service_method" label="Service Method" kind="text"
               placeholder="auth_service.validate_token…" />
            <F id="external_api_call" label="External API" kind="text"
               placeholder="moderation_service.screen…" />
            <F id="condition" label="Condition" kind="text"
               placeholder="input.is_valid == true…" />
            <F id="database_query" label="Database Query" kind="textarea"
               placeholder="SELECT * FROM …" />
            <F id="input_schema" label="Input Schema (JSON)" kind="json" />
            <F id="output_schema" label="Output Schema (JSON)" kind="json" />

            {/* 4. Execution Config */}
            <SectionHeader title="Execution Config" />
            <F id="retry_count" label="Retry Count" kind="number"
               placeholder="0" min={0} max={10} />
            <F id="timeout_ms" label="Timeout (ms)" kind="number"
               placeholder="5000" min={1} />
            <F id="sla_ms" label="SLA (ms)" kind="number"
               placeholder="10000" min={1} />
            {/* is_async — checkbox, not handled by F helper */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="is_async"
                type="checkbox"
                checked={draft.is_async ?? false}
                onChange={(e) => handleChange("is_async", e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <label
                htmlFor="is_async"
                className="text-xs text-gray-300 select-none cursor-pointer"
              >
                Async execution
              </label>
            </div>

            {/* 5. Documentation */}
            <SectionHeader title="Documentation" />
            <F id="owner_team" label="Owner Team" kind="text"
               placeholder="payments-team, auth-squad…" span2 />

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-4 py-2.5
                        border-t border-gray-700 shrink-0">
          {saveError
            ? <p className="text-red-400 text-xs">{saveError}</p>
            : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-xs bg-gray-700 hover:bg-gray-600
                         disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-50 text-white px-4 py-1.5
                         rounded font-medium"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
