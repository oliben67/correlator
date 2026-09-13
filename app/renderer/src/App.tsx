import { useCallback, useEffect, useState } from "react";
import { AddSump } from "./AddSump.js";
import { Correlate } from "./Correlate.js";
import type { SumpSummary } from "./correlator-api.js";
import { SumpSwitcher } from "./SumpSwitcher.js";

export function App() {
  const [sumps, setSumps] = useState<SumpSummary[] | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([window.correlator.listSumps(), window.correlator.getPrimarySumpId()])
      .then(([sumpsResult, primaryResult]) => {
        setSumps(sumpsResult);
        setPrimaryId(primaryResult);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A sump that failed to install lands in "retired" (cor-CORE.PROVISION-004)
  // -- treated as absent here so a failed attempt doesn't leave a
  // confusing permanent row where the "Add Sump" chooser belongs.
  const liveSumps = sumps?.filter((sump) => sump.status !== "retired") ?? null;

  // cor-CORE.PROVISION-008: correlator has one addressable concept, the
  // log Sump -- a root Sump with a discovered host is hidden here, only
  // its host-scoped children are selectable; a root with no discovered
  // hosts yet stays selectable so a just-connected Sump never shows a
  // blank screen.
  const selectableSumps =
    liveSumps?.filter(
      (sump) =>
        sump.parentSumpId !== null || !liveSumps.some((other) => other.parentSumpId === sump.id),
    ) ?? null;

  // cor-CORE.PROVISION-007: the primary Sump if one is selected and still
  // selectable, else the first selectable Sump -- a UI-selection concept,
  // distinct from SumpState's "active" (reachability).
  const activeSump =
    selectableSumps?.find((sump) => sump.id === primaryId) ?? selectableSumps?.[0] ?? null;

  return (
    <div>
      <h1>correlator</h1>
      {error && <p role="alert">{error}</p>}
      {selectableSumps === null && !error && <p>Loading sumps…</p>}
      {selectableSumps !== null && selectableSumps.length === 0 && (
        <AddSump onSumpAdded={refresh} />
      )}
      {selectableSumps !== null && selectableSumps.length > 0 && (
        <>
          <SumpSwitcher sumps={selectableSumps} primaryId={primaryId} onChange={refresh} />
          {activeSump && <Correlate sumpId={activeSump.id} />}
        </>
      )}
    </div>
  );
}
