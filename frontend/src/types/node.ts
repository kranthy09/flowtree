export type NodeType =
  | "api"
  | "endpoint"
  | "request"
  | "response"
  | "field"
  | "model"
  | "step";

export interface NodeResponse {
  id: string;
  workspace_id: string;
  node_type: NodeType;
  name: string;
  description: string | null;
  tags: string[];
  parent_id: string | null;
  position_x: number;
  position_y: number;
  // API root
  title: string | null;
  version: string | null;
  base_url: string | null;
  tech_stack: string | null;
  architecture_notes: string | null;
  auth_scheme: string | null;
  // Endpoint
  method: string | null;
  path: string | null;
  summary: string | null;
  operation_id: string | null;
  deprecated: boolean;
  query_params: Record<string, unknown>[];
  service_method: string | null;
  database_query: string | null;
  conditions: string[];
  is_async: boolean;
  // Request / Response
  content_type: string;
  model_ref: string | null;
  example: Record<string, unknown> | null;
  validation_rules: string[];
  status_code: number | null;
  is_error: boolean;
  error_type: string | null;
  // Field
  field_type: string | null;
  field_format: string | null;
  required: boolean;
  nullable: boolean;
  read_only: boolean;
  write_only: boolean;
  default_value: unknown;
  items_type: string | null;
  items_ref: string | null;
  object_ref: string | null;
  constraints: Record<string, unknown>;
  field_example: unknown;
  // Model
  base_class: string | null;
  orm_table: string | null;
  indexes: string[];
  // Step
  language: string;
  code: string | null;
  input_keys: string[];
  output_key: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Tree endpoint populates this; flat list returns []
  children: NodeResponse[];
}

export interface NodeCreate {
  node_type: NodeType;
  name: string;
  parent_id?: string | null;
  position_x?: number;
  position_y?: number;
  [key: string]: unknown;
}

export interface NodeUpdate {
  name?: string;
  position_x?: number;
  position_y?: number;
  parent_id?: string | null;
  [key: string]: unknown;
}
