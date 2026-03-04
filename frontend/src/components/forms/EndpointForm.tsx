"use client";

import { useCallback, useRef } from "react";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TagInput } from "@/components/ui/TagInput";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const METHOD_OPTIONS = [
  { value: "GET",     label: "GET" },
  { value: "POST",    label: "POST" },
  { value: "PUT",     label: "PUT" },
  { value: "PATCH",   label: "PATCH" },
  { value: "DELETE",  label: "DELETE" },
  { value: "HEAD",    label: "HEAD" },
  { value: "OPTIONS", label: "OPTIONS" },
];

interface EndpointFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function EndpointForm({ node, workspaceId }: EndpointFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  // Immediate save for selects and switches
  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Select
        label="Method"
        value={node.method ?? "GET"}
        options={METHOD_OPTIONS}
        onChange={(v) => saveNow({ method: v })}
      />
      <Input
        label="Path"
        value={node.path}
        placeholder="/users/{id}"
        mono
        onChange={(v) => save({ path: v })}
      />
      <Input
        label="Summary"
        value={node.summary}
        placeholder="Get user by ID"
        onChange={(v) => save({ summary: v })}
      />
      <Input
        label="Operation ID"
        value={node.operation_id}
        placeholder="getUserById"
        mono
        onChange={(v) => save({ operation_id: v })}
      />
      <TagInput
        label="Tags"
        value={node.tags ?? []}
        onChange={(v) => saveNow({ tags: v })}
      />
      <Input
        label="Service Method"
        value={node.service_method}
        placeholder="UserService.get_by_id"
        mono
        onChange={(v) => save({ service_method: v })}
      />
      <Textarea
        label="Database Query"
        value={node.database_query}
        rows={3}
        placeholder="SELECT * FROM users WHERE id = :id"
        mono
        onChange={(v) => save({ database_query: v })}
      />
      <TagInput
        label="Conditions / Guards"
        value={node.conditions ?? []}
        placeholder="user.is_active, request.user.is_admin"
        onChange={(v) => saveNow({ conditions: v })}
      />
      <Switch
        label="Is Async"
        checked={node.is_async}
        onChange={(v) => saveNow({ is_async: v })}
      />
      <Switch
        label="Deprecated"
        checked={node.deprecated}
        onChange={(v) => saveNow({ deprecated: v })}
      />
    </div>
  );
}
