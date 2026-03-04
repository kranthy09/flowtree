"use client";

import { useCallback, useRef } from "react";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const AUTH_OPTIONS = [
  { value: "none",       label: "None" },
  { value: "Bearer",     label: "Bearer Token" },
  { value: "ApiKey",     label: "API Key" },
  { value: "Basic",      label: "Basic Auth" },
  { value: "OAuth2",     label: "OAuth 2.0" },
];

interface ApiFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function ApiForm({ node, workspaceId }: ApiFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Input
        label="Title"
        value={node.title}
        placeholder="My API"
        onChange={(v) => save({ title: v })}
      />
      <Input
        label="Version"
        value={node.version}
        placeholder="1.0.0"
        onChange={(v) => save({ version: v })}
      />
      <Input
        label="Base URL"
        value={node.base_url}
        placeholder="https://api.example.com"
        mono
        onChange={(v) => save({ base_url: v })}
      />
      <Input
        label="Tech Stack"
        value={node.tech_stack}
        placeholder="FastAPI, PostgreSQL, Redis"
        onChange={(v) => save({ tech_stack: v })}
      />
      <Select
        label="Auth Scheme"
        value={node.auth_scheme}
        options={AUTH_OPTIONS}
        onChange={(v) => save({ auth_scheme: v })}
      />
      <Textarea
        label="Architecture Notes"
        value={node.architecture_notes}
        rows={4}
        placeholder="High-level architecture description…"
        onChange={(v) => save({ architecture_notes: v })}
      />
    </div>
  );
}
