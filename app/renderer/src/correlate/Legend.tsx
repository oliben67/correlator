/**
 * Container legend (cor-CORE.CORRELATE-000007), ported from cttc's
 * `renderLegend`/`wireDragReorder`: a colored swatch + name per container;
 * click hides/shows it, drag onto another entry moves it before that one.
 * Presentational -- state lives in the series atoms (SeriesCharts.tsx).
 */

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  hidden: boolean;
}

export interface LegendProps {
  entries: LegendEntry[];
  onToggle: (key: string) => void;
  onReorder: (dragged: string, target: string) => void;
}

const DRAG_TYPE = "text/correlator-series";

export function Legend({ entries, onToggle, onReorder }: LegendProps) {
  if (entries.length === 0) return null;
  return (
    <ul
      aria-label="Containers"
      style={{
        listStyle: "none",
        margin: "4px 0",
        padding: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      {entries.map((entry) => (
        <li
          key={entry.key}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, entry.key);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const dragged = e.dataTransfer.getData(DRAG_TYPE);
            if (dragged) onReorder(dragged, entry.key);
          }}
        >
          <button
            type="button"
            aria-pressed={!entry.hidden}
            data-series={entry.key}
            title={entry.hidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
            onClick={() => onToggle(entry.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "1px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface-1)",
              color: entry.hidden ? "var(--muted)" : "var(--text-primary)",
              textDecoration: entry.hidden ? "line-through" : "none",
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.85em",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: entry.hidden ? "var(--muted)" : entry.color,
              }}
            />
            {entry.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
