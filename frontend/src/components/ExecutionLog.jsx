/**
 * ExecutionLog — shows per-node results of the latest run.
 *
 * Props:
 *   activeRun    — RunResponse { run_id, executions[] } | null
 *   nodes        — all NumberNode objects (for name lookup)
 *   onClear      — () => void
 *   onRerun      — (rootNodeId) => void
 *   onSelectNode — (nodeId) => void   (opens Level-4 detail panel)
 *   rootNodeId   — int | null         (re-run target)
 */
import { useState } from "react";

const STATUS_ICON = {
  SUCCESS: "✅",
  FAILED:  "❌",
  PENDING: "⏳",
  RUNNING: "🔄",
};

const STATUS_CLS = {
  SUCCESS: "bg-green-900/60 text-green-300",
  FAILED:  "bg-red-900/60  text-red-300",
  PENDING: "bg-gray-700    text-gray-400",
  RUNNING: "bg-blue-900/60 text-blue-300",
};

function CollapseJSON({ data }) {
  const [open, setOpen] = useState(false);
  if (!data) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline select-none"
      >
        {open ? "hide" : "show"} JSON
      </button>
      {open && (
        <pre className="mt-1 text-[10px] text-gray-300 bg-gray-900 rounded p-1.5 overflow-x-auto max-w-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ExecutionLog({
  activeRun,
  nodes,
  onClear,
  onRerun,
  onSelectNode,
  rootNodeId,
}) {
  if (!activeRun) return null;

  const nodeMap = new Map((nodes ?? []).map((n) => [n.id, n]));
  const executions = activeRun.executions ?? [];
  const totalMs = executions.reduce((s, e) => s + (e.duration_ms ?? 0), 0);
  const failed = executions.filter((e) => e.status === "FAILED").length;

  return (
    <div
      className="shrink-0 border-t border-gray-700 bg-gray-900 flex flex-col"
      style={{ maxHeight: "38vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold select-none shrink-0">
            Execution Log
          </span>
          <span className="text-[10px] text-gray-600 font-mono truncate select-none">
            {activeRun.run_id}
          </span>
          <span className="text-[10px] text-gray-500 shrink-0">
            {executions.length} node{executions.length !== 1 ? "s" : ""}
            {" · "}
            {totalMs}ms
            {failed > 0 && (
              <span className="ml-1 text-red-400">{failed} failed</span>
            )}
          </span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {rootNodeId != null && (
            <button
              onClick={() => onRerun(rootNodeId)}
              className="text-[11px] bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 py-1 rounded"
            >
              Re-run
            </button>
          )}
          <button
            onClick={onClear}
            className="text-[11px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase w-6">#</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Node</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Input</th>
              <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Output / Error</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((ex, idx) => {
              const node = nodeMap.get(ex.node_id);
              return (
                <tr
                  key={ex.id}
                  className="border-b border-gray-800 hover:bg-gray-800/40"
                >
                  <td className="px-3 py-1.5 text-gray-600">{idx + 1}</td>

                  {/* Node name — clickable */}
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => onSelectNode(ex.node_id)}
                      className="text-left hover:text-indigo-400 transition-colors"
                    >
                      <span className="text-gray-500">#{ex.node_id}</span>
                      {node?.name && (
                        <span className="ml-1 text-gray-200">{node.name}</span>
                      )}
                    </button>
                  </td>

                  {/* Status badge */}
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        STATUS_CLS[ex.status] ?? "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {STATUS_ICON[ex.status] ?? "?"} {ex.status}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="px-3 py-1.5 text-gray-400 tabular-nums">
                    {ex.duration_ms != null ? `${ex.duration_ms}ms` : "—"}
                  </td>

                  {/* Input */}
                  <td className="px-3 py-1.5">
                    <CollapseJSON data={ex.input_data} />
                  </td>

                  {/* Output / error */}
                  <td className="px-3 py-1.5">
                    {ex.status === "FAILED" && ex.error_message ? (
                      <span className="text-red-400 text-[10px]">
                        {ex.error_message}
                      </span>
                    ) : (
                      <CollapseJSON data={ex.output_data} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
