/**
 * NodeDetailPanel — slide-up panel for editing Level 4 business logic fields.
 *
 * Props: { node, onSave, onClose }
 *   node    — the full node object (null hides the panel)
 *   onSave  — async (id, patchData) => void  — called with only changed fields
 *   onClose — () => void
 */
import { useState, useEffect, useRef } from "react";

const LOGIC_FIELDS = [
  { key: "service_method",    label: "Service Method",    kind: "text"     },
  { key: "external_api_call", label: "External API",      kind: "text"     },
  { key: "condition",         label: "Condition",         kind: "text"     },
  { key: "database_query",    label: "Database Query",    kind: "textarea" },
  { key: "input_schema",      label: "Input Schema (JSON)",  kind: "json"  },
  { key: "output_schema",     label: "Output Schema (JSON)", kind: "json"  },
];

function toJsonString(value) {
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

export default function NodeDetailPanel({ node, onSave, onClose }) {
  // draft holds raw string values for every field
  const [draft, setDraft] = useState({});
  const [jsonErrors, setJsonErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const panelRef = useRef(null);

  // Reset draft whenever the selected node changes
  useEffect(() => {
    if (!node) return;
    setDraft({
      service_method:    node.service_method    ?? "",
      external_api_call: node.external_api_call ?? "",
      condition:         node.condition         ?? "",
      database_query:    node.database_query    ?? "",
      input_schema:      toJsonString(node.input_schema),
      output_schema:     toJsonString(node.output_schema),
    });
    setJsonErrors({});
    setSaveError("");
  }, [node]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!node) return null;

  const handleChange = (key, raw) => {
    setDraft((d) => ({ ...d, [key]: raw }));
    // Clear json error while typing
    if (key === "input_schema" || key === "output_schema") {
      setJsonErrors((e) => ({ ...e, [key]: null }));
    }
  };

  const handleSave = async () => {
    // Validate JSON fields first
    const errors = {};
    let hasError = false;
    for (const key of ["input_schema", "output_schema"]) {
      const raw = draft[key].trim();
      if (raw) {
        try { JSON.parse(raw); }
        catch { errors[key] = `Invalid JSON in ${key}`; hasError = true; }
      }
    }
    if (hasError) { setJsonErrors(errors); return; }

    // Build patch with ONLY changed fields
    const patch = {};

    // Plain text fields
    for (const key of ["service_method", "external_api_call", "condition", "database_query"]) {
      const newVal = draft[key].trim() || null;
      const oldVal = node[key] ?? null;
      if (newVal !== oldVal) patch[key] = newVal;
    }

    // JSON fields — compare by canonical JSON string
    for (const key of ["input_schema", "output_schema"]) {
      const raw = draft[key].trim();
      const newVal = raw ? JSON.parse(raw) : null;
      const oldStr = toJsonString(node[key]);
      const newStr = toJsonString(newVal);
      if (newStr !== oldStr) patch[key] = newVal;
    }

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
    "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs " +
    "text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 " +
    "resize-none";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 flex items-end justify-stretch"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        className="w-full bg-gray-850 border-t border-gray-700 shadow-2xl z-50 flex flex-col"
        style={{ backgroundColor: "#111827", maxHeight: "55vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 select-none">Node Detail</span>
            <span className="text-sm font-semibold text-indigo-300">
              #{node.id}{node.name ? ` · ${node.name}` : ""}
            </span>
            {node.type && (
              <span className="text-[10px] px-1.5 py-px rounded bg-gray-700 text-gray-400">
                {node.type}
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LOGIC_FIELDS.map(({ key, label, kind }) => {
              const hasError = !!jsonErrors[key];
              const fieldCls =
                inp + (hasError ? " border-red-500" : "");

              return (
                <div key={key} className={kind === "json" || kind === "textarea" ? "sm:col-span-1" : ""}>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 select-none">
                    {label}
                  </label>
                  {kind === "text" ? (
                    <input
                      type="text"
                      className={fieldCls}
                      value={draft[key] ?? ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                    />
                  ) : (
                    <textarea
                      className={fieldCls + " font-mono"}
                      rows={kind === "json" ? 4 : 3}
                      value={draft[key] ?? ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={kind === "json" ? '{"key": "value"}' : "Enter query…"}
                    />
                  )}
                  {hasError && (
                    <p className="text-red-400 text-[10px] mt-0.5">{jsonErrors[key]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-700 shrink-0">
          {saveError
            ? <p className="text-red-400 text-xs">{saveError}</p>
            : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded font-medium"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
