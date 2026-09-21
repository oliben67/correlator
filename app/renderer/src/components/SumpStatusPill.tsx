import { useState } from "react";
import type { SumpSummary } from "../correlator-api.js";

// cor-CORE.UI-000005 (RM-000025): correlator's status bar used to show a
// static colored dot + name with no way to act on it. This is the one
// unified Sump status indicator cttc's own Gateway/Docker-Host pills
// were both structurally identical precedents for -- a native <details>
// disclosure (no new dependency, no hand-rolled open/close state) that
// lists every known Sump and lets you switch which one is primary
// directly from the status bar, re-checking the live list the moment
// it's opened.
//
// Deliberately not ported: cttc's right-click New/Edit/Uninstall/
// Current-Status context menu -- those actions already exist in the
// Sump Manager tab's SumpSwitcher, and duplicating them here would be a
// second place for the same action to drift out of sync, not a real
// gap.

export interface SumpStatusPillProps {
  sumps: SumpSummary[];
  primarySump: SumpSummary | null;
  onRefresh: () => void;
  onSelectPrimary: (sumpId: string) => void;
}

function dotColor(sump: SumpSummary | null): string {
  if (!sump) return "var(--muted)";
  // "up" has no cttc token either -- ported as its own literal, matching
  // cttc's own non-tokenized status-dot convention (style.css:208-211).
  return sump.status === "active" ? "#2ecc71" : "var(--critical)";
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}

export function SumpStatusPill({
  sumps,
  primarySump,
  onRefresh,
  onSelectPrimary,
}: SumpStatusPillProps) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => {
        const nowOpen = e.currentTarget.open;
        setOpen(nowOpen);
        if (nowOpen) onRefresh();
      }}
      style={{ position: "relative" }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <Dot color={dotColor(primarySump)} />
        Sump: {primarySump ? primarySump.name : "None connected"}
      </summary>

      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: 0,
          marginBottom: 4,
          background: "var(--surface-1)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          minWidth: 200,
          padding: 4,
        }}
      >
        {sumps.length === 0 && (
          <div style={{ padding: "4px 8px", color: "var(--text-secondary)" }}>No Sumps yet</div>
        )}
        {sumps.map((sump) => (
          <button
            type="button"
            key={sump.id}
            onClick={() => {
              onSelectPrimary(sump.id);
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              width: "100%",
              padding: "4px 8px",
              background: sump.id === primarySump?.id ? "var(--surface-2)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left",
              color: "inherit",
            }}
          >
            <Dot color={dotColor(sump)} />
            {sump.name}
            {sump.id === primarySump?.id ? " (primary)" : ""}
          </button>
        ))}
      </div>
    </details>
  );
}
