"use client";

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <label
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           "8px",
        cursor:        "pointer",
        userSelect:    "none",
        fontSize:      "0.8rem",
        color:         "var(--text-primary)",
      }}
    >
      {/* Hidden native checkbox for accessibility */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {/* Visual track */}
      <span
        style={{
          display:        "inline-flex",
          width:          "32px",
          height:         "18px",
          borderRadius:   "9px",
          background:     checked ? "var(--primary)" : "var(--border)",
          transition:     "background 0.15s",
          alignItems:     "center",
          padding:        "2px",
          flexShrink:     0,
        }}
      >
        {/* Thumb */}
        <span
          style={{
            width:        "14px",
            height:       "14px",
            borderRadius: "50%",
            background:   "#fff",
            transform:    checked ? "translateX(14px)" : "translateX(0)",
            transition:   "transform 0.15s",
          }}
        />
      </span>
      {label}
    </label>
  );
}
