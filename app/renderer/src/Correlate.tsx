import { useSetAtom } from "jotai/react";
import { useCallback, useEffect, useState } from "react";
import { cursorTAtom, viewAtom } from "./correlate/atoms.js";
import { Chart } from "./correlate/Chart.js";
import { EventDensityLane } from "./correlate/EventDensityLane.js";
import { LogPanel } from "./correlate/LogPanel.js";
import {
  defaultWindow,
  epochMsToIso,
  metricContainerIds,
  toChartPoints,
  toEventTimestamps,
  toLogRows,
} from "./correlate/recordMapping.js";
import type { SumpRecord } from "./correlator-api.js";

// cor-CORE.CORRELATE-006: wires the already-built, already-tested
// correlation engine (cor-CORE.CORRELATE-001 through -005) to real data.
// Deliberately minimal -- a fixed recent window, manual refresh only, no
// live-follow/auto-advance (that's cttc's LIVE domain, explicitly
// deferred to a later roadmap phase). No metric-field picker, no
// multi-container charting -- see REQ-000016's Open questions.
//
// cor-CORE.PROVISION-008: `sumpId` alone identifies what to show --
// correlator has one addressable concept, the log Sump, already scoped
// to a single docker_host by the time it reaches here. There is no
// internal data-source picker; picking a Sump in the switcher already
// picked a data source.

type LoadState = { phase: "loading" } | { phase: "ready" } | { phase: "error"; message: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function Correlate({ sumpId }: { sumpId: string }) {
  const setView = useSetAtom(viewAtom);
  const setCursorT = useSetAtom(cursorTAtom);

  const [records, setRecords] = useState<SumpRecord[]>([]);
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const { t0, t1 } = defaultWindow(Date.now());
      setView({ t0, t1 });
      const page = await window.correlator.queryRecords(sumpId, {
        kind: "both",
        start: epochMsToIso(t0),
        end: epochMsToIso(t1),
      });
      setRecords(page.records);
      setState({ phase: "ready" });
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  }, [sumpId, setView]);

  useEffect(() => {
    // A cursor from a previous Sump's series is meaningless here.
    setCursorT(null);
    load();
  }, [load, setCursorT]);

  const chartContainerId = metricContainerIds(records)[0];

  return (
    <div>
      <button type="button" onClick={() => load()}>
        Refresh
      </button>

      {state.phase === "error" && <p role="alert">{state.message}</p>}

      <EventDensityLane recordTimestamps={toEventTimestamps(records)} />
      <Chart points={toChartPoints(records, "cpu_pct", chartContainerId)} />
      <LogPanel rows={toLogRows(records)} />
    </div>
  );
}
