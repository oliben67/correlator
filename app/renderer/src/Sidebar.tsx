export type NavView = "correlate" | "sumps" | "events" | "preferences" | "about";

export interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navItems: { id: NavView; label: string; icon: string }[] = [
    { id: "correlate", label: "Correlation", icon: "📊" },
    { id: "sumps", label: "Sump Manager", icon: "🔌" },
    { id: "events", label: "Event Triggers", icon: "⚡" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  return (
    <nav
      style={{
        width: "200px",
        background: "#1e1e1e",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "12px 8px",
        boxSizing: "border-box",
        borderRight: "1px solid #333",
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: "1.1em", padding: "8px", marginBottom: "16px" }}>
        Correlator
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
                background: isActive ? "#007acc" : "transparent",
                color: "#fff",
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
