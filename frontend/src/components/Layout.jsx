import { useState } from "react";
import NodeForm from "./NodeForm";
import NodeExplorer from "./NodeExplorer";
import MermaidDiagram from "./MermaidDiagram";
import NodeDetailPanel from "./NodeDetailPanel";
import ExecutionLog from "./ExecutionLog";

export default function Layout({
  nodes,
  onAdd,
  onUpdate,
  onDelete,
  error,
  selectedNode,
  selectNode,
  // Level 5 execution props
  activeRun,
  onRun,
  onClearRun,
  runLoading,
  runError,
}) {
  const [selectedRoot, setSelectedRoot] = useState("");

  // Root nodes = nodes with no parent_id
  const rootNodes = nodes.filter((n) => !n.parent_id);

  // Track which root was used for the last run (for Re-run)
  const [lastRootId, setLastRootId] = useState(null);

  const handleRun = () => {
    const id = Number(selectedRoot);
    if (!id) return;
    setLastRootId(id);
    onRun(id);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* ── Header ── */}
      <header className="flex items-center px-6 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0 gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-indigo-400 tracking-wide shrink-0">
          Flow Tree
        </h1>

        {error && (
          <span className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded">
            {error}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Run controls */}
        <div className="flex items-center gap-2 shrink-0">
          {runError && (
            <span className="text-xs text-red-400">{runError}</span>
          )}
          <select
            value={selectedRoot}
            onChange={(e) => setSelectedRoot(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100
                       focus:outline-none focus:border-indigo-500 max-w-[180px]"
            title="Select root node to run from"
          >
            <option value="">Select root node</option>
            {rootNodes.map((n) => (
              <option key={n.id} value={n.id}>
                #{n.id}{n.name ? `: ${n.name}` : ""} ({n.value})
              </option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={!selectedRoot || runLoading}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white text-xs font-medium px-3 py-1.5 rounded whitespace-nowrap"
          >
            {runLoading ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                Running…
              </>
            ) : (
              "▶ Run"
            )}
          </button>
        </div>
      </header>

      {/* ── Main: Explorer + Diagram ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — node explorer */}
        <div className="w-2/5 flex flex-col border-r border-gray-700 min-w-0">
          <NodeForm nodes={nodes} onAdd={onAdd} />
          <NodeExplorer
            nodes={nodes}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onSelect={selectNode}
          />
        </div>

        {/* Right panel — diagram */}
        <div className="w-3/5 bg-gray-900 overflow-hidden">
          <MermaidDiagram
            nodes={nodes}
            onNodeClick={selectNode}
            activeRun={activeRun}
          />
        </div>
      </div>

      {/* ── Execution Log (shown after run) ── */}
      <ExecutionLog
        activeRun={activeRun}
        nodes={nodes}
        onClear={onClearRun}
        onRerun={(rootId) => {
          setLastRootId(rootId);
          onRun(rootId);
        }}
        onSelectNode={selectNode}
        rootNodeId={lastRootId}
      />

      {/* ── Detail Panel (shown on node click) ── */}
      <NodeDetailPanel
        node={selectedNode}
        onSave={onUpdate}
        onClose={() => selectNode(null)}
      />
    </div>
  );
}
