import { useEffect, useRef, useState } from "react";
import svgPanZoom from "svg-pan-zoom";

let renderSeq = 0;

const TYPE_COLORS = {
  input: "fill:#1e40af,color:#dbeafe,stroke:#1e3a8a",
  process: "fill:#92400e,color:#fef3c7,stroke:#78350f",
  output: "fill:#166534,color:#dcfce7,stroke:#14532d",
  default: "fill:#1e293b,color:#e2e8f0,stroke:#475569",
};

function buildCode(nodes) {
  if (!nodes.length) {
    return 'graph TD\n  empty["No nodes yet"]';
  }

  const lines = ["graph TD"];
  const styleLines = [];
  // Track edges drawn via left/right child to avoid duplicate parent_id arrows
  const childEdgesDrawn = new Set();

  // Node definitions
  for (const n of nodes) {
    const label = n.name ? `${n.name}\\n(${n.value})` : String(n.value);
    lines.push(`  n${n.id}["#35;${n.id}: ${label}"]`);
  }

  // Left/right child edges — labeled L and R
  for (const n of nodes) {
    if (n.left_child_id) {
      lines.push(`  n${n.id} -->|L| n${n.left_child_id}`);
      childEdgesDrawn.add(`${n.id}-${n.left_child_id}`);
    }
    if (n.right_child_id) {
      lines.push(`  n${n.id} -->|R| n${n.right_child_id}`);
      childEdgesDrawn.add(`${n.id}-${n.right_child_id}`);
    }
  }

  // parent_id edges only when not already covered by a child edge
  for (const n of nodes) {
    if (n.parent_id && !childEdgesDrawn.has(`${n.parent_id}-${n.id}`)) {
      lines.push(`  n${n.parent_id} --> n${n.id}`);
    }
  }

  // Style lines per node
  for (const n of nodes) {
    const color = TYPE_COLORS[n.type] ?? TYPE_COLORS.default;
    styleLines.push(`  style n${n.id} ${color}`);
  }

  return (
    lines.join("\n") + (styleLines.length ? "\n" + styleLines.join("\n") : "")
  );
}

export default function MermaidDiagram({ nodes }) {
  const containerRef = useRef(null);
  const spzRef = useRef(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !window.mermaid) return;

    let cancelled = false;

    // Destroy the previous svg-pan-zoom instance before replacing the SVG
    if (spzRef.current) {
      try {
        spzRef.current.destroy();
      } catch (_) {}
      spzRef.current = null;
    }

    const id = `mermaid-svg-${++renderSeq}`;
    const code = buildCode(nodes);

    window.mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        // Remove Mermaid's inline size constraints so the SVG fills the container
        svgEl.style.maxWidth = "";
        svgEl.removeAttribute("width");
        svgEl.removeAttribute("height");
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";

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
        try {
          spzRef.current.destroy();
        } catch (_) {}
        spzRef.current = null;
      }
    };
  }, [nodes]);

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
