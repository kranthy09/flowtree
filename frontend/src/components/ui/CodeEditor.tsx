"use client";

import dynamic from "next/dynamic";

// Monaco must not be imported server-side
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const LABEL_STYLE = {
  display:       "block",
  marginBottom:  "4px",
  fontSize:      "0.7rem",
  fontWeight:    600,
  color:         "var(--text-secondary)" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

interface CodeEditorProps {
  label: string;
  value: string | null | undefined;
  language?: string;
  onChange?: (v: string) => void;
  height?: string;
  readOnly?: boolean;
}

export function CodeEditor({
  label,
  value,
  language = "python",
  onChange,
  height = "200px",
  readOnly = false,
}: CodeEditorProps) {
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div
        style={{
          border:       "1px solid var(--border)",
          borderRadius: "4px",
          overflow:     "hidden",
          height,
        }}
      >
        <Editor
          height={height}
          language={language}
          value={value ?? ""}
          theme="vs-dark"
          options={{
            minimap:              { enabled: false },
            fontSize:             12,
            lineNumbers:          "on",
            scrollBeyondLastLine: false,
            wordWrap:             "on",
            tabSize:              2,
            automaticLayout:      true,
            readOnly,
          }}
          onChange={(v) => onChange?.(v ?? "")}
        />
      </div>
    </div>
  );
}
