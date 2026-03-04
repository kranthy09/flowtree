import axios from "axios";
import type { NodeCreate, NodeResponse, NodeUpdate } from "@/types/node";
import type { WorkspaceCreate, WorkspaceDetail, WorkspaceResponse, WorkspaceUpdate } from "@/types/workspace";
import type { RunDetail, RunResponse, RunSummary } from "@/types/execution";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ── Workspaces ─────────────────────────────────────────────────────────────

export const fetchWorkspaces = (): Promise<WorkspaceResponse[]> =>
  api.get<WorkspaceResponse[]>("/workspaces").then((r) => r.data);

export const fetchWorkspace = (id: string): Promise<WorkspaceDetail> =>
  api.get<WorkspaceDetail>(`/workspaces/${id}`).then((r) => r.data);

export const createWorkspace = (data: WorkspaceCreate): Promise<WorkspaceResponse> =>
  api.post<WorkspaceResponse>("/workspaces", data).then((r) => r.data);

export const updateWorkspace = (id: string, data: WorkspaceUpdate): Promise<WorkspaceResponse> =>
  api.put<WorkspaceResponse>(`/workspaces/${id}`, data).then((r) => r.data);

export const deleteWorkspace = (id: string): Promise<void> =>
  api.delete(`/workspaces/${id}`).then(() => undefined);

// ── Nodes ──────────────────────────────────────────────────────────────────

export const fetchNodes = (workspaceId: string): Promise<NodeResponse[]> =>
  api.get<NodeResponse[]>(`/workspaces/${workspaceId}/nodes`).then((r) => r.data);

export const createNode = (workspaceId: string, data: NodeCreate): Promise<NodeResponse> =>
  api.post<NodeResponse>(`/workspaces/${workspaceId}/nodes`, data).then((r) => r.data);

export const updateNode = (
  workspaceId: string,
  nodeId: string,
  data: NodeUpdate,
): Promise<NodeResponse> =>
  api
    .put<NodeResponse>(`/workspaces/${workspaceId}/nodes/${nodeId}`, data)
    .then((r) => r.data);

export const deleteNode = (workspaceId: string, nodeId: string): Promise<void> =>
  api.delete(`/workspaces/${workspaceId}/nodes/${nodeId}`).then(() => undefined);

// ── Exports ─────────────────────────────────────────────────────────────────

export interface ExportResult {
  content:  string;
  format:   string;
  filename: string;
}

export const exportOpenApi = (
  workspaceId: string,
  output_format: "json" | "yaml",
): Promise<ExportResult> =>
  api
    .post<ExportResult>(`/workspaces/${workspaceId}/export/openapi`, { output_format })
    .then((r) => r.data);

export const exportSchema = (
  workspaceId: string,
  model_name: string | null,
): Promise<ExportResult> =>
  api
    .post<ExportResult>(`/workspaces/${workspaceId}/export/schema`, { model_name })
    .then((r) => r.data);

export const exportPrompt = (workspaceId: string): Promise<ExportResult> =>
  api
    .post<ExportResult>(`/workspaces/${workspaceId}/export/prompt`, {})
    .then((r) => r.data);

// ── Import ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  count:   number;
  message: string;
}

export const importOpenApi = (
  workspaceId: string,
  content: string,
  merge: boolean,
): Promise<ImportResult> =>
  api
    .post<ImportResult>(`/workspaces/${workspaceId}/import/openapi`, { content, merge })
    .then((r) => r.data);

// ── Executions ──────────────────────────────────────────────────────────────

export const runPipeline = (
  workspaceId: string,
  initial_context: Record<string, unknown>,
): Promise<RunResponse> =>
  api
    .post<RunResponse>(`/workspaces/${workspaceId}/run`, { initial_context })
    .then((r) => r.data);

export const fetchRuns = (workspaceId: string): Promise<RunSummary[]> =>
  api.get<RunSummary[]>(`/workspaces/${workspaceId}/executions`).then((r) => r.data);

export const fetchRunDetail = (workspaceId: string, runId: string): Promise<RunDetail> =>
  api
    .get<RunDetail>(`/workspaces/${workspaceId}/executions/${runId}`)
    .then((r) => r.data);

export default api;
