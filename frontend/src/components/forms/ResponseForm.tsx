"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const ERROR_TYPE_OPTIONS = [
  { value: "",                    label: "—" },
  { value: "ValidationError",     label: "ValidationError" },
  { value: "NotFoundError",       label: "NotFoundError" },
  { value: "AuthenticationError", label: "AuthenticationError" },
  { value: "AuthorizationError",  label: "AuthorizationError" },
  { value: "ConflictError",       label: "ConflictError" },
  { value: "ServerError",         label: "ServerError" },
];

interface ResponseFormProps {
  node: NodeResponse;
  workspaceId: string;
  /** MODEL nodes in this workspace for model_ref select. */
  modelNodes: NodeResponse[];
}

export function ResponseForm({ node, workspaceId, modelNodes }: ResponseFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  const modelOptions = [
    { value: "", label: "— none —" },
    ...modelNodes.map((m) => ({ value: m.name, label: m.name })),
  ];

  const exampleStr = node.example ? JSON.stringify(node.example, null, 2) : "";

  function saveExample(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      save({ example: parsed });
    } catch {
      // skip invalid JSON
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Input
        label="Status Code"
        type="number"
        value={node.status_code}
        placeholder="200"
        onChange={(v) => save({ status_code: v === "" ? null : Number(v) })}
      />
      <Switch
        label="Is Error Response"
        checked={node.is_error}
        onChange={(v) => saveNow({ is_error: v })}
      />
      {node.is_error && (
        <Select
          label="Error Type"
          value={node.error_type ?? ""}
          options={ERROR_TYPE_OPTIONS}
          onChange={(v) => saveNow({ error_type: v || null })}
        />
      )}
      <Select
        label="Model Ref ($ref)"
        value={node.model_ref ?? ""}
        options={modelOptions}
        onChange={(v) => saveNow({ model_ref: v || null })}
      />
      <CodeEditor
        label="Example (JSON)"
        language="json"
        value={exampleStr}
        height="160px"
        onChange={saveExample}
      />
    </div>
  );
}
