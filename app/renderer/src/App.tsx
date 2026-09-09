import { useEffect, useState } from "react";
import type { SumpSummary } from "./correlator-api.js";

export function App() {
  const [sumps, setSumps] = useState<SumpSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.correlator
      .listSumps()
      .then(setSumps)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div>
      <h1>correlator</h1>
      {error && <p role="alert">{error}</p>}
      {sumps === null && !error && <p>Loading sumps…</p>}
      {sumps !== null && sumps.length === 0 && <p>No sumps provisioned yet.</p>}
      {sumps !== null && sumps.length > 0 && (
        <ul>
          {sumps.map((sump) => (
            <li key={sump.id}>
              {sump.name} — {sump.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
