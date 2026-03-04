"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { ConstraintBuilder } from "@/components/ui/ConstraintBuilder";
import { useUpdateNode } from "@/hooks/useNodes";
import type { NodeResponse, NodeUpdate } from "@/types/node";

const TYPE_OPTIONS = [
  { value: "string",  label: "string" },
  { value: "integer", label: "integer" },
  { value: "number",  label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "array",   label: "array" },
  { value: "object",  label: "object" },
];

const FORMAT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: "",          label: "— none —" },
    { value: "email",     label: "email" },
    { value: "uuid",      label: "uuid" },
    { value: "date",      label: "date" },
    { value: "date-time", label: "date-time" },
    { value: "uri",       label: "uri" },
    { value: "password",  label: "password" },
  ],
  integer: [
    { value: "",      label: "— none —" },
    { value: "int32", label: "int32" },
    { value: "int64", label: "int64" },
  ],
  number: [
    { value: "",       label: "— none —" },
    { value: "float",  label: "float" },
    { value: "double", label: "double" },
  ],
};

interface FieldFormProps {
  node: NodeResponse;
  workspaceId: string;
}

export function FieldForm({ node, workspaceId }: FieldFormProps) {
  const { mutate } = useUpdateNode(workspaceId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: NodeUpdate) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutate({ nodeId: node.id, data }), 600);
  }, [mutate, node.id]);

  const saveNow = useCallback((data: NodeUpdate) => {
    mutate({ nodeId: node.id, data });
  }, [mutate, node.id]);

  const fieldType = node.field_type ?? "string";
  const formatOptions = FORMAT_OPTIONS[fieldType] ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Select
        label="Field Type"
        value={fieldType}
        options={TYPE_OPTIONS}
        onChange={(v) => saveNow({ field_type: v, field_format: null })}
      />
      {formatOptions.length > 0 && (
        <Select
          label="Format"
          value={node.field_format ?? ""}
          options={formatOptions}
          onChange={(v) => saveNow({ field_format: v || null })}
        />
      )}
      {fieldType === "array" && (
        <Input
          label="Items Type"
          value={node.items_type}
          placeholder="string"
          onChange={(v) => save({ items_type: v })}
        />
      )}
      {fieldType === "object" && (
        <Input
          label="Object $ref"
          value={node.object_ref}
          placeholder="MyModel"
          onChange={(v) => save({ object_ref: v })}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <Switch label="Required"    checked={node.required}    onChange={(v) => saveNow({ required: v })} />
        <Switch label="Nullable"    checked={node.nullable}    onChange={(v) => saveNow({ nullable: v })} />
        <Switch label="Read Only"   checked={node.read_only}   onChange={(v) => saveNow({ read_only: v })} />
        <Switch label="Write Only"  checked={node.write_only}  onChange={(v) => saveNow({ write_only: v })} />
      </div>
      <fieldset style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "8px" }}>
        <legend style={{ fontSize: "0.7rem", color: "var(--text-secondary)", padding: "0 4px" }}>
          CONSTRAINTS
        </legend>
        <ConstraintBuilder
          fieldType={fieldType}
          value={node.constraints ?? {}}
          onChange={(v) => save({ constraints: v })}
        />
      </fieldset>
    </div>
  );
}
