import { useState, useCallback } from "react";
import { executeTree, fetchExecutions, fetchRun } from "../api/executions";

export function useExecutions() {
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState(null);

  const execute = useCallback(async (rootNodeId) => {
    setLoading(true);
    setRunError(null);
    try {
      const result = await executeTree(rootNodeId);
      setActiveRun(result);
      return result;
    } catch (err) {
      setRunError(err.message || "Execution failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await fetchExecutions());
    } catch (_) {}
  }, []);

  const clearActiveRun = useCallback(() => setActiveRun(null), []);

  const rerun = useCallback(
    async (rootNodeId) => {
      await execute(rootNodeId);
    },
    [execute]
  );

  return {
    runs,
    activeRun,
    loading,
    runError,
    execute,
    loadRuns,
    clearActiveRun,
    rerun,
  };
}
