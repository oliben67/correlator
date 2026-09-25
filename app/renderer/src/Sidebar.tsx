import type { ReactNode } from "react";
import { SumpIcon } from "./icons.js";

export type NavView = "correlate" | "sumps" | "events" | "preferences" | "about";

export interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  /** RM-000029: omitted by DetachedSidebar (an already-detached window
   * has nothing left to detach) -- present only on the docked instance. */
  onDetach?: () => void;
}

export function Sidebar({ activeView, onViewChange, onDetach }: SidebarProps) {
  // Sump Manager gets a real flat icon (cor-CORE.UI-000002, RM-000021) --
  // Correlation/Event Triggers/Preferences keep their emoji placeholder
  // since no icon in `.icons-src` covers those domains yet
  // (`docs/roadmap/cttc-ui-port-audit.md` §4 open question 5). About
  // also stays emoji: `correlator.svg` turned out to carry hardcoded
  // fill colors on inspection, not the flat recolorable mark it was
  // thought to be (see `icons.tsx`'s own header comment).
  const navItems: { id: NavView; label: string; icon: ReactNode }[] = [
    { id: "correlate", label: "Correlation", icon: "📊" },
    { id: "sumps", label: "Sump Manager", icon: <SumpIcon size={16} /> },
    { id: "events", label: "Event Triggers", icon: "⚡" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  return (
    <nav
      style={{
        width: "200px",
        background: "var(--surface-2)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        padding: "12px 8px",
        boxSizing: "border-box",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>Correlator</span>
        {onDetach && (
          <button
            type="button"
            onClick={onDetach}
            title="Detach into its own window"
            aria-label="Detach sidebar"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "1em",
              lineHeight: 1,
            }}
          >
            ⧉
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: isActive ? "var(--accent)" : "transparent",
                color: isActive ? "#fff" : "var(--text-primary)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: isActive ? "bold" : "normal",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
