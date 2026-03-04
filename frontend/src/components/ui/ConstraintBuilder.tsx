"use client";

import { Input } from "./Input";
import { Switch } from "./Switch";
import { TagInput } from "./TagInput";

interface ConstraintBuilderProps {
  fieldType: string | null | undefined;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export function ConstraintBuilder({ fieldType, value, onChange }: ConstraintBuilderProps) {
  function set(key: string, v: unknown) {
    onChange({ ...value, [key]: v });
  }

  function str(key: string): string {
    const v = value[key];
    return v == null ? "" : String(v);
  }

  function num(key: string): string {
    const v = value[key];
    return v == null ? "" : String(v);
  }

  const type = fieldType ?? "string";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(type === "string") && (
        <>
          <Input
            label="Min Length"
            type="number"
            value={num("minLength")}
            onChange={(v) => set("minLength", v === "" ? null : Number(v))}
          />
          <Input
            label="Max Length"
            type="number"
            value={num("maxLength")}
            onChange={(v) => set("maxLength", v === "" ? null : Number(v))}
          />
          <Input
            label="Pattern (regex)"
            value={str("pattern")}
            onChange={(v) => set("pattern", v || null)}
            mono
          />
          <TagInput
            label="Enum values"
            value={Array.isArray(value["enum"]) ? (value["enum"] as string[]) : []}
            onChange={(tags) => set("enum", tags.length ? tags : null)}
          />
        </>
      )}
      {(type === "number" || type === "integer") && (
        <>
          <Input
            label="Minimum"
            type="number"
            value={num("minimum")}
            onChange={(v) => set("minimum", v === "" ? null : Number(v))}
          />
          <Input
            label="Maximum"
            type="number"
            value={num("maximum")}
            onChange={(v) => set("maximum", v === "" ? null : Number(v))}
          />
          <Input
            label="Multiple Of"
            type="number"
            value={num("multipleOf")}
            onChange={(v) => set("multipleOf", v === "" ? null : Number(v))}
          />
          <Switch
            label="Exclusive Minimum"
            checked={Boolean(value["exclusiveMinimum"])}
            onChange={(v) => set("exclusiveMinimum", v)}
          />
          <Switch
            label="Exclusive Maximum"
            checked={Boolean(value["exclusiveMaximum"])}
            onChange={(v) => set("exclusiveMaximum", v)}
          />
        </>
      )}
      {type === "array" && (
        <>
          <Input
            label="Min Items"
            type="number"
            value={num("minItems")}
            onChange={(v) => set("minItems", v === "" ? null : Number(v))}
          />
          <Input
            label="Max Items"
            type="number"
            value={num("maxItems")}
            onChange={(v) => set("maxItems", v === "" ? null : Number(v))}
          />
          <Switch
            label="Unique Items"
            checked={Boolean(value["uniqueItems"])}
            onChange={(v) => set("uniqueItems", v)}
          />
        </>
      )}
    </div>
  );
}
