"use client";

import type { CSSProperties } from "react";

const LABEL: CSSProperties = {
  display:       "block",
  marginBottom:  "4px",
  fontSize:      "0.7rem",
  fontWeight:    600,
  color:         "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const SELECT_STYLE: CSSProperties = {
  width:        "100%",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.8rem",
  padding:      "6px 8px",
  outline:      "none",
  cursor:       "pointer",
  boxSizing:    "border-box",
};

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, value, onChange, options, placeholder }: SelectProps) {
  return (
    <label style={{ display: "block" }}>
      <span style={LABEL}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={SELECT_STYLE}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
