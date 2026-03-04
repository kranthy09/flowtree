"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

interface ModelFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function ModelForm({ node, workspaceId }: ModelFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Input
        label="Base Class"
        value={node.base_class}
        placeholder="BaseModel"
        onChange={(v) => save({ base_class: v })}
      />
      <Input
        label="ORM Table"
        value={node.orm_table}
        placeholder="users"
        mono
        onChange={(v) => save({ orm_table: v })}
      />
      <TagInput
        label="Indexes"
        value={node.indexes ?? []}
        placeholder="email, (name, created_at)"
        onChange={(v) => saveNow({ indexes: v })}
      />
    </div>
  );
}
