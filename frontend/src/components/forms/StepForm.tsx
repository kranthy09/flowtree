"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const LANGUAGE_OPTIONS = [
  { value: "python",     label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "sql",        label: "SQL" },
  { value: "bash",       label: "Bash" },
];

interface StepFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function StepForm({ node, workspaceId }: StepFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  const language = node.language || "python";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Select
        label="Language"
        value={language}
        options={LANGUAGE_OPTIONS}
        onChange={(v) => saveNow({ language: v })}
      />
      <CodeEditor
        label="Code"
        language={language}
        value={node.code}
        height="260px"
        onChange={(v) => save({ code: v })}
      />
      <TagInput
        label="Input Keys"
        value={node.input_keys ?? []}
        placeholder="user_id, token"
        onChange={(v) => saveNow({ input_keys: v })}
      />
      <Input
        label="Output Key"
        value={node.output_key}
        placeholder="result"
        mono
        onChange={(v) => save({ output_key: v })}
      />
    </div>
  );
}
