import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRunDetail, fetchRuns, runPipeline } from "@/lib/api";
import type { RunSummary } from "@/types/execution";

const ACTIVE_STATUSES = new Set(["pending", "running"]);

// ── List of all runs for a workspace ─────────────────────────────────────────
// Polls every 3 s when any run is still active.

export function useRuns(workspaceId: string) {
  return useQuery({
    queryKey:  ["runs", workspaceId] as const,
    queryFn:   () => fetchRuns(workspaceId),
    enabled:   !!workspaceId,
    refetchInterval: (query) => {
      const runs: RunSummary[] = query.state.data ?? [];
      return runs.some((r) => ACTIVE_STATUSES.has(r.status.toLowerCase())) ? 3_000 : false;
    },
    refetchOnWindowFocus: false,
  });
}

// ── Detail of a single run ───────────────────────────────────────────────────
// Polls every 2 s while the run is still active.

export function useRunDetail(workspaceId: string, runId: string | null) {
  return useQuery({
    queryKey:  ["run", workspaceId, runId] as const,
    queryFn:   () => fetchRunDetail(workspaceId, runId!),
    enabled:   !!workspaceId && !!runId,
    refetchInterval: (query) => {
      const status: string = query.state.data?.status ?? "";
      return ACTIVE_STATUSES.has(status.toLowerCase()) ? 2_000 : false;
    },
    refetchOnWindowFocus: false,
  });
}

// ── Trigger a new pipeline run ───────────────────────────────────────────────

export function useRunPipeline(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (initial_context: Record<string, unknown>) =>
      runPipeline(workspaceId, initial_context),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs", workspaceId] });
    },
  });
}
