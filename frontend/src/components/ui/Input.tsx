"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

const BASE: CSSProperties = {
  width:        "100%",
  background:   "var(--bg-elevated)",
  border:       "1px solid var(--border)",
  borderRadius: "4px",
  color:        "var(--text-primary)",
  fontSize:     "0.8rem",
  padding:      "6px 8px",
  outline:      "none",
  boxSizing:    "border-box",
};

const LABEL: CSSProperties = {
  display:      "block",
  marginBottom: "4px",
  fontSize:     "0.7rem",
  fontWeight:   600,
  color:        "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ── Text / number input ───────────────────────────────────────────────────────

interface InputProps {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  mono?: boolean;
}

export function Input({ label, value, onChange, type = "text", placeholder, mono }: InputProps) {
  const [local, setLocal] = useState<string>(String(value ?? ""));

  return (
    <label style={{ display: "block" }}>
      <span style={LABEL}>{label}</span>
      <input
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        style={{ ...BASE, fontFamily: mono ? "monospace" : "inherit" }}
      />
    </label>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}

export function Textarea({ label, value, onChange, rows = 3, placeholder, mono }: TextareaProps) {
  const [local, setLocal] = useState<string>(value ?? "");

  return (
    <label style={{ display: "block" }}>
      <span style={LABEL}>{label}</span>
      <textarea
        rows={rows}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        style={{ ...BASE, resize: "vertical", fontFamily: mono ? "monospace" : "inherit" }}
      />
    </label>
  );
}
