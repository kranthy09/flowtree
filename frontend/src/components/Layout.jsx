import NodeForm from "./NodeForm";
import NodeExplorer from "./NodeExplorer";
import MermaidDiagram from "./MermaidDiagram";
import NodeDetailPanel from "./NodeDetailPanel";

export default function Layout({
  nodes,
  onAdd,
  onUpdate,
  onDelete,
  error,
  selectedNode,
  selectNode,
}) {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <header className="flex items-center px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-lg font-bold text-indigo-400 tracking-wide">
          Flow Tree
        </h1>
        {error && (
          <span className="ml-4 text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded">
            {error}
          </span>
        )}
      </header>

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
          <MermaidDiagram nodes={nodes} onNodeClick={selectNode} />
        </div>
      </div>

      {/* Detail panel — slides up from bottom when a node is selected */}
      <NodeDetailPanel
        node={selectedNode}
        onSave={onUpdate}
        onClose={() => selectNode(null)}
      />
    </div>
  );
}
