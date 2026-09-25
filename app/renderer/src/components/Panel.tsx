import type { CSSProperties, ReactNode } from "react";

// cor-CORE.UI-000003 (RM-000022): the "bordered panel" look was
// independently reimplemented three times (AddSump.tsx's sectionStyle,
// SumpSwitcher.tsx's rowStyle, two inline duplicates in Correlate.tsx)
// -- this is the one real component those all migrate onto, matching
// cttc's own bordered-panel convention (border/radius/shadow tokens).

export interface PanelProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function Panel({ children, style }: PanelProps) {
  return (
    <div
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        padding: 12,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
