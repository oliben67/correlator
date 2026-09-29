import { useCallback, useEffect, useState } from "react";
import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";
import { AboutDialog } from "./AboutDialog.js";
import { AddSump } from "./AddSump.js";
import { preferenceEffects, usePreferences } from "./appPreferences.js";
import { BootSplash } from "./BootSplash.js";
import { Correlate } from "./Correlate.js";
import { DataStreamPicker } from "./components/DataStreamPicker.js";
import { useSyncedView } from "./correlate/useSyncedView.js";
import type { SumpSummary } from "./correlator-api.js";
import { notify } from "./notifications.js";
import { Preferences } from "./Preferences.js";
import { ProjectView } from "./ProjectView.js";
import { type RecordingStatusReport, statusBarRecordingStatus } from "./recordingStatus.js";
import { type NavView, Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { SumpSwitcher } from "./SumpSwitcher.js";
import { isCorrelatable, resolveActiveSump, selectableSumps } from "./sumpSelection.js";

export function App() {
  const [sumps, setSumps] = useState<SumpSummary[] | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavView>("correlate");
  const [error, setError] = useState<string | null>(null);
  // RM-000029: which panels are currently detached into their own
  // window -- kept here (not per-tab, e.g. inside Correlate) since
  // Sidebar is detachable too and lives outside Correlate entirely, and
  // so a detached chart/log panel stays hidden in the docked view even
  // if the user switches nav tabs away from "correlate" and back.
  const [detachedKinds, setDetachedKinds] = useState<Set<DetachPanelKind>>(new Set());
  // BUG-000005: last recording status Correlate reported. Kept here, not
  // reset when Correlate unmounts on a tab switch -- the session keeps
  // recording server-side, and the status bar must keep saying so.
  const [recordingReport, setRecordingReport] = useState<RecordingStatusReport | null>(null);

  useSyncedView();
  // cor-CORE.SHELL-000008: load and apply the saved preferences.
  const effects = preferenceEffects(usePreferences());

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

  useEffect(() => {
    return window.correlator.onDetachedPanelClosed(({ kind }) => {
      setDetachedKinds((prev) => {
        if (!prev.has(kind)) return prev;
        const next = new Set(prev);
        next.delete(kind);
        return next;
      });
    });
  }, []);

  // cor-CORE.PROJECT-000007: outcomes of main-process actions (File menu,
  // project actions, a session segment rerouted to the default project)
  // arrive as pushes and join the same notification feed.
  useEffect(() => {
    return window.correlator.onMainNotification(({ message, severity }) =>
      notify(message, severity),
    );
  }, []);

  useEffect(() => {
    return window.correlator.onSync((message) => {
      if (message.type === "nav") setActiveNav(message.view);
    });
  }, []);

  const handleNavChange = useCallback((view: NavView) => {
    setActiveNav(view);
    window.correlator.broadcastSync({ type: "nav", view });
  }, []);

  const handleDetach = useCallback((kind: DetachPanelKind, state: DetachViewState) => {
    setDetachedKinds((prev) => new Set(prev).add(kind));
    window.correlator.openDetachedPanel(kind, state).catch(() => {
      setDetachedKinds((prev) => {
        const next = new Set(prev);
        next.delete(kind);
        return next;
      });
    });
  }, []);

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
        {!detachedKinds.has("sidebar") && (
          <Sidebar
            activeView={activeNav}
            onViewChange={handleNavChange}
            onDetach={() => handleDetach("sidebar", {})}
          />
        )}

        <main style={{ flex: 1, padding: "16px", overflowY: "auto", background: "#ffffff" }}>
          {error && (
            <p role="alert" style={{ color: "#dc3545" }}>
              {error}
            </p>
          )}

          {selectable !== null && selectable.length === 0 ? (
            <AddSump onSumpAdded={refresh} />
          ) : (
            <>
              {activeNav === "correlate" && (
                <div>
                  <SumpSwitcher sumps={selectable ?? []} primaryId={primaryId} onChange={refresh} />
                  {isCorrelatable(activeSump) ? (
                    <Correlate
                      sumpId={activeSump.id}
                      chartDetached={detachedKinds.has("chart")}
                      logDetached={detachedKinds.has("log")}
                      onDetach={handleDetach}
                      onRecordingStatusChange={setRecordingReport}
                    />
                  ) : (
                    activeSump && <p>{activeSump.name} isn't reporting from any docker host yet.</p>
                  )}
                </div>
              )}

              {activeNav === "project" && (
                <ProjectView
                  sumps={selectable ?? []}
                  activeSumpId={isCorrelatable(activeSump) ? activeSump.id : null}
                />
              )}

              {activeNav === "sumps" && (
                <div>
                  <h2>Sump Manager</h2>
                  <SumpSwitcher sumps={selectable ?? []} primaryId={primaryId} onChange={refresh} />
                  {isCorrelatable(activeSump) && (
                    <div style={{ marginTop: "20px" }}>
                      <DataStreamPicker sumpId={activeSump.id} />
                    </div>
                  )}
                  <div style={{ marginTop: "20px" }}>
                    <h3>Add Connection</h3>
                    <AddSump onSumpAdded={refresh} />
                  </div>
                </div>
              )}

              {activeNav === "events" && (
                <div>
                  {isCorrelatable(activeSump) ? (
                    <Correlate
                      sumpId={activeSump.id}
                      chartDetached={detachedKinds.has("chart")}
                      logDetached={detachedKinds.has("log")}
                      onDetach={handleDetach}
                      onRecordingStatusChange={setRecordingReport}
                    />
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

      {effects.showStatusBar && (
        <StatusBar
          sumps={selectable ?? []}
          primarySump={activeSump}
          recordingStatus={statusBarRecordingStatus(recordingReport, activeSump?.id ?? null)}
          clearAfterMs={effects.notificationClearMs}
          onRefresh={refresh}
          onSelectPrimary={(sumpId) => {
            const name = selectable?.find((s) => s.id === sumpId)?.name ?? sumpId;
            window.correlator
              .selectPrimarySump({ sumpId })
              .then(() => {
                notify(`Switched primary Sump to "${name}"`);
                refresh();
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
                notify(`Could not switch to "${name}": ${message}`, "error");
              });
          }}
        />
      )}
    </div>
  );
}
