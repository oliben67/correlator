import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";
import {
  capturePointInTimeSnapshot,
  captureRangeSnapshot,
  formatSnapshotJson,
  formatSnapshotRaw,
  type Snapshot,
} from "../../lib/snapshot.js";
import { preferenceEffects, preferencesAtom } from "./appPreferences.js";
import {
  InterruptedSessionNotice,
  interruptionPoint,
  type ResumeFrom,
} from "./components/InterruptedSessionNotice.js";
import { ModeBadge } from "./components/ModeBadge.js";
import { cursorTAtom, liveAtom, type Viewport, viewAtom } from "./correlate/atoms.js";
import {
  type ChartCapture,
  ChartCaptureContext,
  captureArmedAtom,
  rangeCapture,
} from "./correlate/chartCapture.js";
import { resumeLive } from "./correlate/correlate.js";
import { EventDensityLane } from "./correlate/EventDensityLane.js";
import { LogPanel } from "./correlate/LogPanel.js";
import { LatestRequest, loadWindow, REFETCH_DEBOUNCE_MS } from "./correlate/liveView.js";
import {
  defaultWindow,
  epochMsToIso,
  toEventTimestamps,
  toLogRows,
} from "./correlate/recordMapping.js";
import { SeriesCharts, useSeriesPalette } from "./correlate/SeriesCharts.js";
import type {
  EventRuleSummary,
  RecordingSessionSummary,
  RuleEvaluationSummary,
  SumpRecord,
} from "./correlator-api.js";
import { notify } from "./notifications.js";
import type { RecordingStatusReport } from "./recordingStatus.js";

// cor-CORE.CORRELATE-006: wires the correlation engine to real data.
// cor-CORE.ARCHIVE-003: adds live recording session state control toolbar
// and crash interruption notices.
// cor-CORE.EVENT-000001/-000002: adds event triggers, scheduling, & rolling buffer.
// cor-CORE.EXPORT-000001/-000002: adds snapshot capture, view format toggle, copy & export.

type LoadState = { phase: "loading" } | { phase: "ready" } | { phase: "error"; message: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface CorrelateProps {
  sumpId: string;
  /** RM-000029: whether the chart/log panel is currently detached into
   * its own window -- owned by App.tsx (it must survive this component
   * unmounting on a nav-tab switch), not local state here. */
  chartDetached?: boolean;
  logDetached?: boolean;
  onDetach?: (kind: DetachPanelKind, state: DetachViewState) => void;
  /** BUG-000005: reports this view's recording-session status so App can
   * show it in the status bar (cor-CORE.SHELL-000004 §2). */
  onRecordingStatusChange?: (report: RecordingStatusReport) => void;
}

export function Correlate({
  sumpId,
  chartDetached,
  logDetached,
  onDetach,
  onRecordingStatusChange,
}: CorrelateProps) {
  const view = useAtomValue(viewAtom);
  const setView = useSetAtom(viewAtom);
  const setCursorT = useSetAtom(cursorTAtom);
  const cursorT = useAtomValue(cursorTAtom);
  const live = useAtomValue(liveAtom);
  const [captureArmed, setCaptureArmed] = useAtom(captureArmedAtom);
  const store = useStore();
  const requests = useRef(new LatestRequest());
  // cor-CORE.SHELL-000008: fetch limit and auto-refresh come from preferences.
  const { queryLimit, autoRefreshMs } = preferenceEffects(useAtomValue(preferencesAtom));

  const [records, setRecords] = useState<SumpRecord[]>([]);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [session, setSession] = useState<RecordingSessionSummary | null>(null);
  const [interrupted, setInterrupted] = useState<RecordingSessionSummary[]>([]);
  const [eventRules, setEventRules] = useState<EventRuleSummary[]>([]);
  const [evalResults, setEvalResults] = useState<RuleEvaluationSummary[]>([]);

  // Snapshot State
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [viewFormat, setViewFormat] = useState<"json" | "raw">("json");
  const [snapStartIso, setSnapStartIso] = useState("");
  const [snapEndIso, setSnapEndIso] = useState("");

  // New Rule Form State
  const [ruleName, setRuleName] = useState("");
  const [conditionType, setConditionType] = useState<"metric" | "log">("metric");
  const [metricName, setMetricName] = useState("cpu_pct");
  const [operator, setOperator] = useState<"gt" | "lt" | "eq" | "gte" | "lte">("gt");
  const [threshold, setThreshold] = useState("80");
  const [pattern, setPattern] = useState("ERROR");
  const [action, setAction] = useState<"start_recording" | "stop_recording" | "notify">(
    "start_recording",
  );

  const loadEventRules = useCallback(async () => {
    try {
      const rules = await window.correlator.listEventRules({ sumpId });
      setEventRules(rules);
    } catch {
      // Best effort
    }
  }, [sumpId]);

  /** `quiet` (auto-refresh, re-fetch): no loading state, and a failure
   * keeps the data already shown instead of replacing the view with an
   * error. cor-CORE.CORRELATE-000009: live moves the view to now (keeping
   * its span); paused queries the view as it is. Only the latest request's
   * result lands. */
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setState({ phase: "loading" });
      const ticket = requests.current.next();
      try {
        const isLive = store.get(liveAtom);
        const { t0, t1 } = loadWindow(store.get(viewAtom), isLive, Date.now());
        if (isLive) setView({ t0, t1 });
        const page = await window.correlator.queryRecords(sumpId, {
          kind: "both",
          start: epochMsToIso(t0),
          end: epochMsToIso(t1),
          limit: queryLimit,
        });
        if (!requests.current.isLatest(ticket)) return;
        setRecords(page.records);
        setState({ phase: "ready" });

        // Evaluate event rules on telemetry load
        if (page.records.length > 0) {
          const evals = await window.correlator.evaluateEventRules({
            sumpId,
            samples: page.records,
          });
          setEvalResults(evals);
        }
      } catch (err) {
        if (!quiet && requests.current.isLatest(ticket)) {
          setState({ phase: "error", message: errorMessage(err) });
        }
      }
    },
    [sumpId, setView, queryLimit, store],
  );

  const loadSession = useCallback(async () => {
    try {
      const active = await window.correlator.getRecordingSession({ sumpId });
      setSession(active);
      const interruptedList = await window.correlator.getInterruptedSessions();
      setInterrupted(interruptedList.filter((s) => s.sumpId === sumpId));
    } catch {
      // Best effort session load
    }
  }, [sumpId]);

  // A (re)mounted or switched view starts live on the default window.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset per Sump.
  useEffect(() => {
    setCursorT(null);
    store.set(liveAtom, true);
    store.set(captureArmedAtom, false);
    setView(defaultWindow(Date.now()));
  }, [sumpId, store, setView, setCursorT]);

  useEffect(() => {
    load();
    loadSession();
    loadEventRules();
  }, [load, loadSession, loadEventRules]);

  // cor-CORE.CORRELATE-000009 §5: a paused view that moves is re-queried.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on each move.
  useEffect(() => {
    if (live) return;
    const timer = setTimeout(() => load(true), REFETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [live, view.t0, view.t1, load]);

  useEffect(() => {
    if (autoRefreshMs === null) return;
    const timer = setInterval(() => load(true), autoRefreshMs);
    return () => clearInterval(timer);
  }, [autoRefreshMs, load]);

  // BUG-000005: tag with the session's own Sump when there is one, so a
  // session still held from before a Sump switch is never attributed to
  // the new Sump.
  const reportedSumpId = session?.sumpId ?? sumpId;
  const reportedStatus = session?.status ?? "idle";
  useEffect(() => {
    onRecordingStatusChange?.({ sumpId: reportedSumpId, status: reportedStatus });
  }, [onRecordingStatusChange, reportedSumpId, reportedStatus]);

  const handleStartSession = async () => {
    try {
      const res = await window.correlator.startRecordingSession({ sumpId });
      setSession(res);
      notify("Recording started");
    } catch (err) {
      notify(`Could not start recording: ${errorMessage(err)}`, "error");
    }
  };

  const handlePauseSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.pauseRecordingSession({ sessionId: session.id });
      setSession(res);
      notify("Recording paused");
    } catch (err) {
      notify(`Could not pause recording: ${errorMessage(err)}`, "error");
    }
  };

  const handleResumeSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.resumeRecordingSession({ sessionId: session.id });
      setSession(res);
      // Resuming answers any interruption notice (BUG-000008).
      setInterrupted((prev) => prev.filter((s) => s.id !== session.id));
      notify("Recording resumed");
    } catch (err) {
      notify(`Could not resume recording: ${errorMessage(err)}`, "error");
    }
  };

  const handleStopSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.stopRecordingSession({ sessionId: session.id });
      setSession(res);
      setInterrupted((prev) => prev.filter((s) => s.id !== session.id));
      notify("Recording stopped");
    } catch (err) {
      notify(`Could not stop recording: ${errorMessage(err)}`, "error");
    }
  };

  // cor-CORE.ARCHIVE-000003 §2 (BUG-000008): the three-way resume choice.
  const handleResumeInterrupted = async (
    interruptedSession: RecordingSessionSummary,
    from: ResumeFrom,
  ) => {
    try {
      const res = await window.correlator.resumeRecordingSession({
        sessionId: interruptedSession.id,
        from,
      });
      if (res?.sumpId === sumpId) setSession(res);
      setInterrupted((prev) => prev.filter((s) => s.id !== interruptedSession.id));
      const point = interruptionPoint(interruptedSession);
      notify(
        from === "interruption" && point
          ? `Resumed from the interruption point (continuing since ${new Date(point).toLocaleString()})`
          : "Resumed from now; the time since the interruption is left as a gap",
      );
    } catch (err) {
      notify(`Could not resume recording: ${errorMessage(err)}`, "error");
    }
  };

  const handleDismissInterrupted = async (sessionId: string) => {
    try {
      await window.correlator.dismissInterruptedSession({ sessionId });
      setInterrupted((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      notify(`Could not dismiss the notice: ${errorMessage(err)}`, "error");
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    try {
      await window.correlator.createEventRule({
        sumpId,
        name: ruleName.trim(),
        conditionType,
        metricName: conditionType === "metric" ? metricName : undefined,
        operator: conditionType === "metric" ? operator : undefined,
        threshold: conditionType === "metric" ? Number(threshold) : undefined,
        pattern: conditionType === "log" ? pattern : undefined,
        action,
      });
      setRuleName("");
      loadEventRules();
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await window.correlator.toggleEventRule({ ruleId, enabled: !currentEnabled });
      loadEventRules();
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await window.correlator.deleteEventRule({ ruleId });
      loadEventRules();
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handlePointInTimeSnapshot = () => {
    const targetMs = cursorT ?? Date.now();
    const snap = capturePointInTimeSnapshot(records, sumpId, targetMs, 60000);
    setActiveSnapshot(snap);
  };

  const handleRangeSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapStartIso || !snapEndIso) return;
    const snap = captureRangeSnapshot(records, sumpId, snapStartIso, snapEndIso);
    setActiveSnapshot(snap);
  };

  // cor-CORE.EXPORT-000003: capture straight from the chart.
  const chartCapture = useMemo<ChartCapture>(
    () => ({
      onRangeSelect: (range: Viewport) => {
        const captured = rangeCapture(records, sumpId, range);
        setSnapStartIso(captured.startIso);
        setSnapEndIso(captured.endIso);
        setActiveSnapshot(captured.snapshot);
        notify(`Captured ${captured.snapshot.records.length} records`);
      },
      onSnapshotAt: (t: number) => {
        const snap = capturePointInTimeSnapshot(records, sumpId, t, 60000);
        setActiveSnapshot(snap);
        notify(`Captured ${snap.records.length} records around the clicked time`);
      },
    }),
    [records, sumpId],
  );

  const handleCopySnapshot = async () => {
    if (!activeSnapshot) return;
    const text =
      viewFormat === "json"
        ? formatSnapshotJson(activeSnapshot, true)
        : formatSnapshotRaw(activeSnapshot);
    try {
      await navigator.clipboard.writeText(text);
      notify("Snapshot copied to clipboard");
    } catch {
      notify("Could not copy the snapshot to the clipboard", "error");
    }
  };

  const handleExportSnapshot = async () => {
    if (!activeSnapshot) return;
    try {
      const res = await window.correlator.downloadRecording({
        sumpId,
        dataStreamId: sumpId,
        start: activeSnapshot.startIso,
        end: activeSnapshot.endIso,
      });
      notify(`Snapshot exported to ${res.filePath}`);
    } catch (err) {
      notify(`Snapshot export failed: ${errorMessage(err)}`, "error");
    }
  };

  // cor-CORE.CORRELATE-000007: hidden containers' log rows are hidden too.
  const palette = useSeriesPalette(records);
  const logRows = toLogRows(records).filter(
    (row) => !row.seriesKey || !palette.hidden.has(row.seriesKey),
  );
  const sessionStatus = session?.status ?? "idle";

  return (
    <div>
      {interrupted.map((intSess) => (
        <InterruptedSessionNotice
          key={intSess.id}
          session={intSess}
          onResume={(from) => handleResumeInterrupted(intSess, from)}
          onDecideLater={() => handleDismissInterrupted(intSess.id)}
        />
      ))}

      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
        <ModeBadge mode={live ? "live" : "paused"} />
        <button type="button" onClick={() => load()}>
          Refresh
        </button>
        {!live && (
          <button
            type="button"
            title="Follow now again, keeping the current span"
            onClick={() => {
              resumeLive(store);
              load();
            }}
          >
            Resume live
          </button>
        )}
        {captureArmed && (
          <span role="status" data-capture-armed="">
            Drag on the chart to capture a range (Esc cancels){" "}
            <button type="button" onClick={() => setCaptureArmed(false)}>
              Cancel
            </button>
          </span>
        )}

        <span style={{ fontWeight: "bold" }}>
          Recording Session: {sessionStatus.toUpperCase()}
          {session && session.segments.length > 0 && ` (${session.segments.length} segment(s))`}
        </span>

        {(sessionStatus === "idle" || sessionStatus === "stopped") && (
          <button type="button" onClick={handleStartSession}>
            Start Recording
          </button>
        )}

        {sessionStatus === "recording" && (
          <>
            <button type="button" onClick={handlePauseSession}>
              Pause Recording
            </button>
            <button type="button" onClick={handleStopSession}>
              Stop Recording
            </button>
          </>
        )}

        {sessionStatus === "paused" && (
          <>
            <button type="button" onClick={handleResumeSession}>
              Resume Recording
            </button>
            <button type="button" onClick={handleStopSession}>
              Stop Recording
            </button>
          </>
        )}
      </div>

      {evalResults.some((r) => r.triggered) && (
        <div role="alert" style={{ background: "#e2e3e5", padding: "8px", marginBottom: "8px" }}>
          <strong>Event Trigger Alert:</strong>{" "}
          {evalResults
            .filter((r) => r.triggered)
            .map((r) => `${r.ruleName} [${r.action}]`)
            .join(", ")}
        </div>
      )}

      {state.phase === "error" && <p role="alert">{state.message}</p>}

      <ChartCaptureContext.Provider value={chartCapture}>
        <EventDensityLane recordTimestamps={toEventTimestamps(records)} />

        <div>
          {onDetach && (
            <button
              type="button"
              onClick={() => onDetach("chart", { sumpId, t0: view.t0, t1: view.t1, cursorT })}
              title="Detach chart into its own window"
              style={{
                float: "right",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              ⧉
            </button>
          )}
          {!chartDetached && <SeriesCharts records={records} />}
        </div>
      </ChartCaptureContext.Provider>

      <div>
        {onDetach && (
          <button
            type="button"
            onClick={() => onDetach("log", { sumpId, t0: view.t0, t1: view.t1, cursorT })}
            title="Detach log panel into its own window"
            style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}
          >
            ⧉
          </button>
        )}
        {!logDetached && <LogPanel rows={logRows} colorOf={palette.colorOf} />}
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <h3>Event Triggers & Scheduling</h3>

        <form
          onSubmit={handleCreateRule}
          style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}
        >
          <input
            type="text"
            placeholder="Rule Name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            required
          />
          <select
            value={conditionType}
            onChange={(e) => setConditionType(e.target.value as "metric" | "log")}
          >
            <option value="metric">Metric Threshold</option>
            <option value="log">Log Pattern (Regex)</option>
          </select>

          {conditionType === "metric" ? (
            <>
              <input
                type="text"
                placeholder="Metric Name"
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
              />
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as "gt" | "lt" | "eq" | "gte" | "lte")}
              >
                <option value="gt">&gt;</option>
                <option value="gte">&gt;=</option>
                <option value="lt">&lt;</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
              </select>
              <input
                type="number"
                placeholder="Threshold"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </>
          ) : (
            <input
              type="text"
              placeholder="Regex Pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          )}

          <select
            value={action}
            onChange={(e) =>
              setAction(e.target.value as "start_recording" | "stop_recording" | "notify")
            }
          >
            <option value="start_recording">Start Recording</option>
            <option value="stop_recording">Stop Recording</option>
            <option value="notify">Notify Only</option>
          </select>

          <button type="submit">Add Rule</button>
        </form>

        <div>
          <h4>Configured Rules ({eventRules.length})</h4>
          {eventRules.length === 0 ? (
            <p>No event rules configured.</p>
          ) : (
            <ul>
              {eventRules.map((rule) => (
                <li key={rule.id} style={{ marginBottom: "6px" }}>
                  <span style={{ color: rule.enabled ? "green" : "gray", marginRight: "8px" }}>
                    ●
                  </span>
                  <strong>{rule.name}</strong> ({rule.conditionType}):{" "}
                  {rule.conditionType === "metric"
                    ? `${rule.metricName} ${rule.operator} ${rule.threshold}`
                    : `/${rule.pattern}/`}{" "}
                  ➔ <em>{rule.action}</em>
                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    style={{ marginLeft: "12px", marginRight: "6px" }}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => handleDeleteRule(rule.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <h3>Snapshots & Sample Export</h3>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <button type="button" onClick={handlePointInTimeSnapshot}>
            Capture Point-in-Time Snapshot (±30s)
          </button>
        </div>

        <form
          onSubmit={handleRangeSnapshot}
          style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}
        >
          <input
            type="text"
            placeholder="Start ISO (e.g. 2026-09-16T10:00:00Z)"
            value={snapStartIso}
            onChange={(e) => setSnapStartIso(e.target.value)}
            required
            style={{ width: "240px" }}
          />
          <input
            type="text"
            placeholder="End ISO (e.g. 2026-09-16T10:05:00Z)"
            value={snapEndIso}
            onChange={(e) => setSnapEndIso(e.target.value)}
            required
            style={{ width: "240px" }}
          />
          <button type="submit">Capture Range Snapshot</button>
        </form>

        {activeSnapshot && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px",
              background: "#f8f9fa",
              border: "1px solid #ddd",
            }}
          >
            <h4>Active View Snapshot ({activeSnapshot.records.length} records)</h4>
            <p style={{ fontSize: "0.85em", color: "#666" }}>
              Time Range: {activeSnapshot.startIso} → {activeSnapshot.endIso}
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={() => setViewFormat(viewFormat === "json" ? "raw" : "json")}
              >
                Format: {viewFormat.toUpperCase()} (Click to toggle)
              </button>
              <button type="button" onClick={handleCopySnapshot}>
                Copy to Clipboard
              </button>
              <button type="button" onClick={handleExportSnapshot}>
                Export as .recording Archive
              </button>
            </div>

            <pre
              style={{
                maxHeight: "200px",
                overflow: "auto",
                background: "#222",
                color: "#fff",
                padding: "8px",
                fontSize: "0.85em",
              }}
            >
              {viewFormat === "json"
                ? formatSnapshotJson(activeSnapshot, true)
                : formatSnapshotRaw(activeSnapshot)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
