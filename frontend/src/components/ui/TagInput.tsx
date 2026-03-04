"use client";

import { useRef, useState, type KeyboardEvent } from "react";

const LABEL_STYLE = {
  display:       "block",
  marginBottom:  "4px",
  fontSize:      "0.7rem",
  fontWeight:    600,
  color:         "var(--text-secondary)" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ label, value, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display:      "flex",
          flexWrap:     "wrap",
          gap:          "4px",
          padding:      "5px 6px",
          background:   "var(--bg-elevated)",
          border:       "1px solid var(--border)",
          borderRadius: "4px",
          minHeight:    "34px",
          cursor:       "text",
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "4px",
              padding:      "1px 6px",
              background:   "var(--bg-base)",
              border:       "1px solid var(--border)",
              borderRadius: "3px",
              fontSize:     "0.75rem",
              color:        "var(--text-primary)",
            }}
          >
            {tag}
            <button
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              style={{
                background: "none",
                border:     "none",
                color:      "var(--text-muted)",
                cursor:     "pointer",
                padding:    "0",
                lineHeight: 1,
                fontSize:   "0.9rem",
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          placeholder={value.length === 0 ? (placeholder ?? "Add tag…") : ""}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (draft.trim()) add(draft); }}
          style={{
            flex:       1,
            minWidth:   "80px",
            background: "transparent",
            border:     "none",
            outline:    "none",
            color:      "var(--text-primary)",
            fontSize:   "0.8rem",
          }}
        />
      </div>
    </div>
  );
}
