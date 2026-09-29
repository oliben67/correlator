/**
 * Thin React wrapper (cor-CORE.CORRELATE-004) -- renders only the rows
 * `logWindow.ts`'s `visibleRange` says are in view (plus overscan), as
 * absolutely-positioned elements over a spacer sized to the full row
 * count. Row click calls both `setCursor` and `recenterOn`
 * (cor-CORE.CORRELATE-005) -- cttc's "click a log line -> the chart
 * recenters/highlights on that timestamp."
 */

import { useAtomValue, useStore } from "jotai/react";
import { useState } from "react";
import { cursorTAtom, windowMsAtom } from "./atoms.js";
import { recenterOn, setCursor } from "./correlate.js";
import { visibleRange } from "./logWindow.js";
import { isHighlighted } from "./timeMapping.js";

export interface LogRow {
  ts: number;
  message: string;
  /** cor-CORE.CORRELATE-000007: the container this row belongs to. */
  seriesKey?: string;
}

export interface LogPanelProps {
  rows: LogRow[];
  rowHeight?: number;
  containerHeight?: number;
  /** cor-CORE.CORRELATE-000007: a row's container color, for its chip. */
  colorOf?: (seriesKey: string) => string | undefined;
}

export function LogPanel({ rows, rowHeight = 22, containerHeight = 300, colorOf }: LogPanelProps) {
  const store = useStore();
  const cursorT = useAtomValue(cursorTAtom);
  const windowMs = useAtomValue(windowMsAtom);
  const [scrollTop, setScrollTop] = useState(0);

  const { i0, i1 } = visibleRange(scrollTop, containerHeight, rowHeight, rows.length);

  const visibleRows = [];
  for (let i = i0; i <= i1; i++) {
    const row = rows[i];
    visibleRows.push(
      <button
        // Index-qualified: rows merged from several sources can share a
        // timestamp (cor-CORE.PROJECT-000008).
        key={`${i}:${row.ts}`}
        type="button"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: i * rowHeight,
          height: rowHeight,
          display: "block",
          width: "100%",
          textAlign: "left",
          border: "none",
          padding: 0,
          font: "inherit",
          cursor: "pointer",
          background: isHighlighted(row.ts, cursorT, windowMs) ? "var(--hl-color)" : "transparent",
        }}
        onClick={() => {
          setCursor(store, row.ts);
          recenterOn(store, row.ts);
        }}
      >
        {(() => {
          const color = row.seriesKey ? colorOf?.(row.seriesKey) : undefined;
          return color ? (
            <span
              data-series-chip={row.seriesKey}
              aria-hidden
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                marginRight: 6,
                background: color,
                verticalAlign: "middle",
              }}
            />
          ) : null;
        })()}
        {row.message}
      </button>,
    );
  }

  return (
    <div
      style={{ position: "relative", overflowY: "auto", height: containerHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto auto 0",
          width: 1,
          height: rows.length * rowHeight,
        }}
      />
      {visibleRows}
    </div>
  );
}
