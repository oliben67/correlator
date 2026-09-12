import { useCallback, useEffect, useState } from "react";
import { AddSump } from "./AddSump.js";
import type { SumpSummary } from "./correlator-api.js";

export function App() {
  const [sumps, setSumps] = useState<SumpSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.correlator
      .listSumps()
      .then(setSumps)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A sump that failed to install lands in "retired" (cor-CORE.PROVISION-004)
  // -- treated as absent here so a failed attempt doesn't leave a
  // confusing permanent row where the "Add Sump" chooser belongs.
  const liveSumps = sumps?.filter((sump) => sump.status !== "retired") ?? null;

  return (
    <div>
      <h1>correlator</h1>
      {error && <p role="alert">{error}</p>}
      {liveSumps === null && !error && <p>Loading sumps…</p>}
      {liveSumps !== null && liveSumps.length === 0 && <AddSump onSumpAdded={refresh} />}
      {liveSumps !== null && liveSumps.length > 0 && (
        <ul>
          {liveSumps.map((sump) => (
            <li key={sump.id}>
              {sump.name} — {sump.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
