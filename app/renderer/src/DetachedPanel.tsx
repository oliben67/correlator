import { useAtomValue } from "jotai/react";
import { useEffect, useState } from "react";
import { viewAtom } from "./correlate/atoms.js";
import { Chart } from "./correlate/Chart.js";
import { LogPanel } from "./correlate/LogPanel.js";
import {
  epochMsToIso,
  metricContainerIds,
  toChartPoints,
  toLogRows,
} from "./correlate/recordMapping.js";
import { useSyncedView } from "./correlate/useSyncedView.js";
import type { SumpRecord } from "./correlator-api.js";

// RM-000029: the detached-window counterpart of the chart/log panel
// that normally lives inside Correlate.tsx. Matches cttc's real design
// (see app/lib/detach.ts's header comment) -- this window doesn't
// receive the main window's already-fetched records over the sync
// relay; it independently re-queries the same sump for its own view
// range, exactly as the docked view does.

export interface DetachedPanelProps {
  kind: "chart" | "log";
  sumpId: string;
}

export function DetachedPanel({ kind, sumpId }: DetachedPanelProps) {
  useSyncedView();
  const view = useAtomValue(viewAtom);
  const [records, setRecords] = useState<SumpRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.correlator
      .queryRecords(sumpId, {
        kind: "both",
        start: epochMsToIso(view.t0),
        end: epochMsToIso(view.t1),
      })
      .then((page) => {
        if (!cancelled) setRecords(page.records);
      })
      .catch(() => {
        // Best effort -- a detached panel showing stale data on a
        // transient fetch error isn't worth its own error UI.
      });
    return () => {
      cancelled = true;
    };
  }, [sumpId, view.t0, view.t1]);

  return (
    <div style={{ padding: 8, height: "100vh", boxSizing: "border-box", overflow: "auto" }}>
      {kind === "chart" ? (
        <Chart points={toChartPoints(records, "cpu_pct", metricContainerIds(records)[0])} />
      ) : (
        <LogPanel rows={toLogRows(records)} />
      )}
    </div>
  );
}
