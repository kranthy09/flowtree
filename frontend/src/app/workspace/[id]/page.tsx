import { FlowCanvas }         from "@/components/canvas/FlowCanvas";
import { CanvasToolbar }      from "@/components/canvas/CanvasToolbar";
import { CanvasContextMenu }  from "@/components/canvas/CanvasContextMenu";
import { RunTrigger }         from "@/components/canvas/RunTrigger";
import { PropertiesPanel }    from "@/components/panels/PropertiesPanel";
import { ExportPanel }        from "@/components/panels/ExportPanel";
import { ExecutionLogPanel }  from "@/components/panels/ExecutionLogPanel";
import { TreeOutlinePanel }   from "@/components/panels/TreeOutlinePanel";

interface WorkspacePageProps {
  params: { id: string };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <FlowCanvas        workspaceId={id} />
      <CanvasToolbar     workspaceId={id} />
      <TreeOutlinePanel  workspaceId={id} />
      <RunTrigger        workspaceId={id} />
      <PropertiesPanel   workspaceId={id} />
      <ExportPanel       workspaceId={id} />
      <ExecutionLogPanel  workspaceId={id} />
      <CanvasContextMenu  workspaceId={id} />
    </div>
  );
}
