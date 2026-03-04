import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNode, deleteNode, fetchNodes, updateNode } from "@/lib/api";
import type { NodeCreate, NodeUpdate } from "@/types/node";

export const nodesQueryKey = (workspaceId: string) =>
  ["nodes", workspaceId] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useNodes(workspaceId: string) {
  return useQuery({
    queryKey: nodesQueryKey(workspaceId),
    queryFn:  () => fetchNodes(workspaceId),
    enabled:  UUID_RE.test(workspaceId),
  });
}

export function useCreateNode(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NodeCreate) => createNode(workspaceId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: nodesQueryKey(workspaceId) }),
  });
}

export function useUpdateNode(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, data }: { nodeId: string; data: NodeUpdate }) =>
      updateNode(workspaceId, nodeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: nodesQueryKey(workspaceId) }),
  });
}

export function useDeleteNode(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => deleteNode(workspaceId, nodeId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: nodesQueryKey(workspaceId) }),
  });
}
