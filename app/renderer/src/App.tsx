import { useCallback, useEffect, useState } from "react";
import { AddSump } from "./AddSump.js";
import { Correlate } from "./Correlate.js";
import type { SumpSummary } from "./correlator-api.js";
import { SumpSwitcher } from "./SumpSwitcher.js";
import { isCorrelatable, resolveActiveSump, selectableSumps } from "./sumpSelection.js";

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

  const selectable = liveSumps === null ? null : selectableSumps(liveSumps);
  const activeSump = selectable === null ? null : resolveActiveSump(selectable, primaryId);

  return (
    <div>
      <h1>correlator</h1>
      {error && <p role="alert">{error}</p>}
      {selectable === null && !error && <p>Loading sumps…</p>}
      {selectable !== null && selectable.length === 0 && <AddSump onSumpAdded={refresh} />}
      {selectable !== null && selectable.length > 0 && (
        <>
          <SumpSwitcher sumps={selectable} primaryId={primaryId} onChange={refresh} />
          {isCorrelatable(activeSump) ? (
            <Correlate sumpId={activeSump.id} />
          ) : (
            activeSump && <p>{activeSump.name} isn't reporting from any docker host yet.</p>
          )}
        </>
      )}
    </div>
  );
}
