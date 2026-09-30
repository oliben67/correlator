// cor-CORE.CORRELATE-000010 §4: names what the view is showing -- "Live"
// (following now), "Paused" (a zoomed or panned live view) or "Analysis"
// (the Project view's files).

export type ViewMode = "live" | "paused" | "analysis";

const LABEL: Record<ViewMode, string> = { live: "Live", paused: "Paused", analysis: "Analysis" };
const COLOR: Record<ViewMode, string> = {
  live: "var(--live-track-color)",
  paused: "var(--warning)",
  analysis: "var(--accent)",
};

export function ModeBadge({ mode }: { mode: ViewMode }) {
  return (
    <span
      data-view-mode={mode}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        fontSize: "0.85em",
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: COLOR[mode],
        }}
      />
      {LABEL[mode]}
    </span>
  );
}
