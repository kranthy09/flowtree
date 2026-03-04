"use client";

import { useCallback, useRef } from "react";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const CONTENT_TYPE_OPTIONS = [
  { value: "application/json",                  label: "application/json" },
  { value: "application/x-www-form-urlencoded", label: "application/x-www-form-urlencoded" },
  { value: "multipart/form-data",               label: "multipart/form-data" },
  { value: "text/plain",                         label: "text/plain" },
];

interface RequestFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function RequestForm({ node, workspaceId }: RequestFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  const exampleStr = node.example ? JSON.stringify(node.example, null, 2) : "";

  function saveExample(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      save({ example: parsed });
    } catch {
      // don't save invalid JSON mid-edit
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Select
        label="Content Type"
        value={node.content_type}
        options={CONTENT_TYPE_OPTIONS}
        onChange={(v) => saveNow({ content_type: v })}
      />
      <TagInput
        label="Validation Rules"
        value={node.validation_rules ?? []}
        placeholder="required, max:255, email"
        onChange={(v) => saveNow({ validation_rules: v })}
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
