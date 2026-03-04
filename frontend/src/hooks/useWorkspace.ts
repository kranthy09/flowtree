import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWorkspace, deleteWorkspace, fetchWorkspace, fetchWorkspaces, updateWorkspace } from "@/lib/api";
import type { WorkspaceCreate, WorkspaceUpdate } from "@/types/workspace";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"] as const,
    queryFn:  fetchWorkspaces,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkspaceCreate) => createWorkspace(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkspaceUpdate }) =>
      updateWorkspace(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey:  ["workspace", workspaceId] as const,
    queryFn:   () => fetchWorkspace(workspaceId),
    enabled:   UUID_RE.test(workspaceId),
    staleTime: 30_000,
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkspaceUpdate) => updateWorkspace(workspaceId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
  });
}
