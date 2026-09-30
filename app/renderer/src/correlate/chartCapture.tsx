/**
 * Range capture from the chart (cor-CORE.EXPORT-000003). A view with a
 * snapshot panel (Correlate) provides `ChartCaptureContext`; strips and
 * lanes under it offer capture drags and the right-click menu. Without a
 * provider (detached windows, the Project view) they keep plain zoom.
 */

import { atom } from "jotai";
import { createContext } from "react";
import { captureRangeSnapshot, type Snapshot } from "../../../lib/snapshot.js";
import type { SumpRecord } from "../correlator-api.js";
import type { Viewport } from "./atoms.js";
import { epochMsToIso } from "./recordMapping.js";

export interface ChartCapture {
  onRangeSelect: (range: Viewport) => void;
  onSnapshotAt: (t: number) => void;
}

export const ChartCaptureContext = createContext<ChartCapture | null>(null);

/** "Capture range…" was chosen: the next drag captures. */
export const captureArmedAtom = atom(false);

/** The range form's bounds and the snapshot a captured range gives. */
export function rangeCapture(
  records: SumpRecord[],
  sumpId: string,
  range: Viewport,
): { startIso: string; endIso: string; snapshot: Snapshot } {
  const startIso = epochMsToIso(range.t0);
  const endIso = epochMsToIso(range.t1);
  return { startIso, endIso, snapshot: captureRangeSnapshot(records, sumpId, startIso, endIso) };
}

export interface ChartMenuProps {
  left: number;
  top: number;
  onCaptureRange: () => void;
  onSnapshotHere: () => void;
}

/** The chart's right-click menu: exactly capture and snapshot. */
export function ChartMenu({ left, top, onCaptureRange, onSnapshotHere }: ChartMenuProps) {
  const item: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "4px 12px",
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  return (
    <div
      role="menu"
      aria-label="Chart actions"
      // Keeps the outside-press listener from closing the menu before a click lands.
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left,
        top,
        zIndex: 10,
        padding: "4px 0",
        background: "var(--surface-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <button type="button" role="menuitem" style={item} onClick={onCaptureRange}>
        Capture range…
      </button>
      <button type="button" role="menuitem" style={item} onClick={onSnapshotHere}>
        Snapshot at this time
      </button>
    </div>
  );
}
