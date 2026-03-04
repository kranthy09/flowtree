import { create } from "zustand";

type Panel = "properties" | "export" | "execution" | null;

/** Screen + flow coordinates captured on right-click. */
export interface CtxMenu {
  screenX: number;
  screenY: number;
  /** Flow-space position (for node creation). */
  flowX:   number;
  flowY:   number;
  /** null = blank-canvas right-click; string = node id that was right-clicked. */
  nodeId:  string | null;
}

export interface CanvasState {
  selectedNodeId:       string | null;
  panelOpen:            Panel;
  executionLogOpen:     boolean;
  nodeExecutionStatus:  Record<string, string>;
  /** Set to a node id to trigger fitView inside FlowCanvas; "__ALL__" fits all nodes. */
  fitToNodeId:          string | null;
  /** Shared Run-modal open state — toolbar + floating button both control this. */
  runModalOpen:         boolean;
  /** Context menu state from right-click on canvas or node. */
  ctxMenu:              CtxMenu | null;
  /** Node id awaiting delete confirmation; shown as an overlay bar. */
  pendingDeleteId:      string | null;
  /** Incremented by Ctrl+S keyboard shortcut; watched by CanvasToolbar to save. */
  saveSignal:           number;

  setSelectedNodeId:      (id: string | null) => void;
  openPanel:              (panel: Panel) => void;
  closePanel:             () => void;
  setExecutionLogOpen:    (open: boolean) => void;
  setNodeExecutionStatus: (s: Record<string, string>) => void;
  setFitToNodeId:         (id: string | null) => void;
  setRunModalOpen:        (open: boolean) => void;
  setCtxMenu:             (menu: CtxMenu | null) => void;
  setPendingDeleteId:     (id: string | null) => void;
  triggerSave:            () => void;
  /** Stubs — full undo/redo requires event-sourcing; wired for keyboard handler. */
  undo:                   () => void;
  redo:                   () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedNodeId:      null,
  panelOpen:           null,
  executionLogOpen:    false,
  nodeExecutionStatus: {},
  fitToNodeId:         null,
  runModalOpen:        false,
  ctxMenu:             null,
  pendingDeleteId:     null,
  saveSignal:          0,

  setSelectedNodeId:      (id)   => set({ selectedNodeId: id }),
  openPanel:              (p)    => set({ panelOpen: p }),
  closePanel:             ()     => set({ panelOpen: null }),
  setExecutionLogOpen:    (open) => set({ executionLogOpen: open }),
  setNodeExecutionStatus: (s)    => set({ nodeExecutionStatus: s }),
  setFitToNodeId:         (id)   => set({ fitToNodeId: id }),
  setRunModalOpen:        (open) => set({ runModalOpen: open }),
  setCtxMenu:             (menu) => set({ ctxMenu: menu }),
  setPendingDeleteId:     (id)   => set({ pendingDeleteId: id }),
  triggerSave:            ()     => set((s) => ({ saveSignal: s.saveSignal + 1 })),
  undo:                   ()     => { /* no-op stub */ },
  redo:                   ()     => { /* no-op stub */ },
}));
