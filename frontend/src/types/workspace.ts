import type { NodeResponse } from "./node";

export interface WorkspaceResponse {
  id: string;
  name: string;
  description: string | null;
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDetail extends WorkspaceResponse {
  nodes: NodeResponse[];
}

export interface WorkspaceCreate {
  name: string;
  description?: string | null;
}

export interface WorkspaceUpdate {
  name?: string | null;
  description?: string | null;
}
