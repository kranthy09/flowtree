"use client";

// Temporary Export button — floats top-right until R8.2 CanvasToolbar is built.
// R8.2 will remove this file and move the button into CanvasToolbar.

import { useCanvasStore } from "@/stores/canvasStore";

export function ExportTrigger() {
  const openPanel  = useCanvasStore((s) => s.openPanel);
  const panelOpen  = useCanvasStore((s) => s.panelOpen);

  return (
    <button
      onClick={() => openPanel("export")}
      style={{
        position:     "fixed",
        top:          "12px",
        right:        panelOpen === "export" ? "492px" : "12px",
        zIndex:       20,
        padding:      "6px 14px",
        background:   "var(--primary)",
        color:        "#fff",
        border:       "none",
        borderRadius: "6px",
        fontSize:     "0.8rem",
        fontWeight:   600,
        cursor:       "pointer",
        transition:   "right 0.2s",
      }}
    >
      Export ↗
    </button>
  );
}
