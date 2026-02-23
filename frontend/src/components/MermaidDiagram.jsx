import { useEffect, useRef, useState } from "react";
import svgPanZoom from "svg-pan-zoom";

let renderSeq = 0;

const TYPE_COLORS = {
  input: "fill:#1e40af,color:#dbeafe,stroke:#1e3a8a",
  process: "fill:#92400e,color:#fef3c7,stroke:#78350f",
  output: "fill:#166534,color:#dcfce7,stroke:#14532d",
  default: "fill:#1e293b,color:#e2e8f0,stroke:#475569",
};

const STATUS_COLORS = {
  SUCCESS: "fill:#166534,color:#dcfce7,stroke:#14532d",
  FAILED:  "fill:#991b1b,color:#fef2f2,stroke:#7f1d1d",
  PENDING: "fill:#374151,color:#9ca3af,stroke:#4b5563",
  RUNNING: "fill:#1e40af,color:#dbeafe,stroke:#1e3a8a",
};

const STATUS_EMOJI = {
  SUCCESS: "\u2705",
  FAILED:  "\u274c",
  PENDING: "\u23f3",
  RUNNING: "\uD83D\uDD04",
};

function getSubtitle(node) {
  if (node.condition) return `\u27e8${node.condition}\u27e9`;
  if (node.service_method) return node.service_method;
  if (node.external_api_call) return node.external_api_call;
  if (node.database_query) return "\uD83D\uDCCA query";
  return null;
}

function nodeShape(n, label) {
  const id = `#35;${n.id}: ${label}`;
  const role = n.node_role;
  if (role === "start" || role === "terminal") {
    return `  n${n.id}(["${id}"])`;   // stadium shape
  }
  if (role === "decision" || (!role && n.condition)) {
    return `  n${n.id}{"${id}"}`;     // diamond shape
  }
  return `  n${n.id}["${id}"]`;       // rectangle (default)
}

function buildCode(nodes, activeRun) {
  if (!nodes.length) {
    return 'graph TD\n  empty["No nodes yet"]';
  }

  // Fast node lookup for edge-label and child branch_condition reads
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build status map from active run
  const statusMap = new Map();
  if (activeRun?.executions) {
    for (const ex of activeRun.executions) {
      statusMap.set(ex.node_id, ex.status);
    }
  }

  const lines = ["graph TD"];
  const styleLines = [];
  const childEdgesDrawn = new Set();

  // Node definitions
  for (const n of nodes) {
    const name = n.name ? n.name : "node";
    const sub = getSubtitle(n);
    let label = sub
      ? `${name}\\n(${n.value})\\n${sub}`
      : n.name
        ? `${n.name}\\n(${n.value})`
        : String(n.value);

    // Append execution status emoji when a run is active
    const status = statusMap.get(n.id);
    if (status && STATUS_EMOJI[status]) {
      label += `\\n${STATUS_EMOJI[status]} ${status}`;
    }

    lines.push(nodeShape(n, label));
  }

  // Left/right child edges — label shows branch_condition when set, else L/R
  for (const n of nodes) {
    if (n.left_child_id) {
      const leftNode = nodeMap.get(n.left_child_id);
      const lLabel = leftNode?.branch_condition ?? "L";
      lines.push(`  n${n.id} -->|${lLabel}| n${n.left_child_id}`);
      childEdgesDrawn.add(`${n.id}-${n.left_child_id}`);
    }
    if (n.right_child_id) {
      const rightNode = nodeMap.get(n.right_child_id);
      const rLabel = rightNode?.branch_condition ?? "R";
      lines.push(`  n${n.id} -->|${rLabel}| n${n.right_child_id}`);
      childEdgesDrawn.add(`${n.id}-${n.right_child_id}`);
    }
  }

  // parent_id edges only when not already covered by a child edge
  for (const n of nodes) {
    if (n.parent_id && !childEdgesDrawn.has(`${n.parent_id}-${n.id}`)) {
      lines.push(`  n${n.parent_id} --> n${n.id}`);
    }
  }

  // Style lines — status overrides type/role when run is active
  for (const n of nodes) {
    const status = statusMap.get(n.id);
    let color;
    if (status && STATUS_COLORS[status]) {
      color = STATUS_COLORS[status];
    } else if (n.node_role === "error") {
      color = "fill:#7f1d1d,color:#fef2f2,stroke:#991b1b";
    } else {
      color = TYPE_COLORS[n.type] ?? TYPE_COLORS.default;
    }
    styleLines.push(`  style n${n.id} ${color}`);
  }

  return (
    lines.join("\n") + (styleLines.length ? "\n" + styleLines.join("\n") : "")
  );
}

export default function MermaidDiagram({ nodes, onNodeClick, activeRun }) {
  const containerRef = useRef(null);
  const spzRef = useRef(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !window.mermaid) return;

    let cancelled = false;

    if (spzRef.current) {
      try { spzRef.current.destroy(); } catch (_) {}
      spzRef.current = null;
    }

    const id = `mermaid-svg-${++renderSeq}`;
    const code = buildCode(nodes, activeRun);

    window.mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        svgEl.style.maxWidth = "";
        svgEl.removeAttribute("width");
        svgEl.removeAttribute("height");
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";

        // Bind click events on diagram nodes
        if (onNodeClick) {
          svgEl.querySelectorAll(".node").forEach((el) => {
            const match = el.id?.match(/n(\d+)/);
            if (match) {
              el.style.cursor = "pointer";
              el.addEventListener("click", () => onNodeClick(Number(match[1])));
            }
          });
        }

        spzRef.current = svgPanZoom(svgEl, {
          controlIconsEnabled: false,
          zoomEnabled: true,
          panEnabled: true,
          mouseWheelZoomEnabled: true,
          dblClickZoomEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.05,
          maxZoom: 20,
          onZoom: (zoom) => {
            if (!cancelled) setZoomPercent(Math.round(zoom * 100));
          },
        });

        setZoomPercent(Math.round(spzRef.current.getZoom() * 100));
      })
      .catch((err) => console.error("Mermaid render error:", err));

    return () => {
      cancelled = true;
      if (spzRef.current) {
        try { spzRef.current.destroy(); } catch (_) {}
        spzRef.current = null;
      }
    };
  }, [nodes, activeRun, onNodeClick]);

  const handleZoomIn = () => {
    if (!spzRef.current) return;
    spzRef.current.zoom(spzRef.current.getZoom() * 1.25);
  };

  const handleZoomOut = () => {
    if (!spzRef.current) return;
    spzRef.current.zoom(spzRef.current.getZoom() / 1.25);
  };

  const handleReset = () => {
    if (!spzRef.current) return;
    spzRef.current.resetZoom();
    spzRef.current.resetPan();
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div ref={containerRef} className="mermaid-output h-full w-full" />

      {/* Controls — top-right overlay */}
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1
                   bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 shadow-lg"
      >
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded
                     text-gray-300 hover:bg-gray-700 hover:text-white
                     text-lg font-bold leading-none select-none"
          title="Zoom out"
        >
          −
        </button>

        <span className="text-xs text-gray-400 w-11 text-center tabular-nums select-none">
          {zoomPercent}%
        </span>

        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded
                     text-gray-300 hover:bg-gray-700 hover:text-white
                     text-lg font-bold leading-none select-none"
          title="Zoom in"
        >
          +
        </button>

        <div className="w-px h-4 bg-gray-600 mx-1" />

        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-indigo-400
                     hover:bg-gray-700 px-2 py-1 rounded select-none"
          title="Reset view"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
