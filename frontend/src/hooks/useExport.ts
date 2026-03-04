import { useQuery } from "@tanstack/react-query";
import { exportOpenApi, exportPrompt, exportSchema } from "@/lib/api";

// POST-as-query pattern: export endpoints are pure computation (no DB side effects).
// useQuery gives us free caching, loading/error state, and refetch().

export function useExportOpenApi(workspaceId: string, format: "json" | "yaml") {
  return useQuery({
    queryKey:            ["export", "openapi", workspaceId, format] as const,
    queryFn:             () => exportOpenApi(workspaceId, format),
    enabled:             !!workspaceId,
    staleTime:           0,          // re-fetch whenever key changes (format toggle)
    gcTime:              5 * 60_000,
    retry:               false,
    refetchOnWindowFocus: false,
  });
}

export function useExportSchema(workspaceId: string, modelName: string | null) {
  return useQuery({
    queryKey:            ["export", "schema", workspaceId, modelName] as const,
    queryFn:             () => exportSchema(workspaceId, modelName),
    enabled:             !!workspaceId,
    staleTime:           0,
    gcTime:              5 * 60_000,
    retry:               false,
    refetchOnWindowFocus: false,
  });
}

export function useExportPrompt(workspaceId: string) {
  return useQuery({
    queryKey:            ["export", "prompt", workspaceId] as const,
    queryFn:             () => exportPrompt(workspaceId),
    enabled:             !!workspaceId,
    staleTime:           0,
    gcTime:              5 * 60_000,
    retry:               false,
    refetchOnWindowFocus: false,
  });
}
