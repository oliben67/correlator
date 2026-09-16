import { useCallback, useEffect, useState } from "react";
import { AboutDialog } from "./AboutDialog.js";
import { AddSump } from "./AddSump.js";
import { BootSplash } from "./BootSplash.js";
import { Correlate } from "./Correlate.js";
import type { SumpSummary } from "./correlator-api.js";
import { Preferences } from "./Preferences.js";
import { NavView, Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { SumpSwitcher } from "./SumpSwitcher.js";
import { isCorrelatable, resolveActiveSump, selectableSumps } from "./sumpSelection.js";

export function App() {
  const [sumps, setSumps] = useState<SumpSummary[] | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavView>("correlate");
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

  if (sumps === null && !error) {
    return <BootSplash status="Loading catalog and Sump connections..." />;
  }

  // A sump that failed to install lands in "retired" (cor-CORE.PROVISION-004)
  // -- treated as absent here so a failed attempt doesn't leave a
  // confusing permanent row where the "Add Sump" chooser belongs.
  const liveSumps = sumps?.filter((sump) => sump.status !== "retired") ?? null;

  const selectable = liveSumps === null ? null : selectableSumps(liveSumps);
  const activeSump = selectable === null ? null : resolveActiveSump(selectable, primaryId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar activeView={activeNav} onViewChange={setActiveNav} />

        <main style={{ flex: 1, padding: "16px", overflowY: "auto", background: "#ffffff" }}>
          {error && <p role="alert" style={{ color: "#dc3545" }}>{error}</p>}

          {selectable !== null && selectable.length === 0 ? (
            <AddSump onSumpAdded={refresh} />
          ) : (
            <>
              {activeNav === "correlate" && (
                <div>
                  <SumpSwitcher sumps={selectable ?? []} primaryId={primaryId} onChange={refresh} />
                  {isCorrelatable(activeSump) ? (
                    <Correlate sumpId={activeSump.id} />
                  ) : (
                    activeSump && (
                      <p>{activeSump.name} isn't reporting from any docker host yet.</p>
                    )
                  )}
                </div>
              )}

              {activeNav === "sumps" && (
                <div>
                  <h2>Sump Manager</h2>
                  <SumpSwitcher sumps={selectable ?? []} primaryId={primaryId} onChange={refresh} />
                  <div style={{ marginTop: "20px" }}>
                    <h3>Add Connection</h3>
                    <AddSump onSumpAdded={refresh} />
                  </div>
                </div>
              )}

              {activeNav === "events" && (
                <div>
                  {isCorrelatable(activeSump) ? (
                    <Correlate sumpId={activeSump.id} />
                  ) : (
                    <p>Connect a Sump to manage event triggers.</p>
                  )}
                </div>
              )}

              {activeNav === "preferences" && <Preferences />}

              {activeNav === "about" && <AboutDialog />}
            </>
          )}
        </main>
      </div>

      <StatusBar primarySump={activeSump} />
    </div>
  );
}
