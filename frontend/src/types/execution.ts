export interface RunResponse {
  run_id:  string;
  status:  string;
  task_id: string;
}

export interface RunSummary {
  run_id:       string;
  workspace_id: string;
  /** "completed" | "running" | "error" */
  status:       string;
  created_at:   string;
}

export interface ExecutionDetail {
  node_id:       string;
  node_name:     string;
  /** "PENDING" | "RUNNING" | "SUCCESS" | "ERROR" | "SKIPPED" */
  status:        string;
  input_data:    Record<string, unknown> | null;
  output_data:   Record<string, unknown> | null;
  error_message: string | null;
  duration_ms:   number | null;
}

export interface RunDetail {
  run_id:       string;
  workspace_id: string;
  status:       string;
  executions:   ExecutionDetail[];
  created_at:   string;
}
