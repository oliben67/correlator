import { useAtomValue, useSetAtom } from "jotai/react";
import { useCallback, useEffect, useState } from "react";
import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";
import {
  capturePointInTimeSnapshot,
  captureRangeSnapshot,
  formatSnapshotJson,
  formatSnapshotRaw,
  type Snapshot,
} from "../../lib/snapshot.js";
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
import type {
  EventRuleSummary,
  RecordingSessionSummary,
  RuleEvaluationSummary,
  SumpRecord,
} from "./correlator-api.js";

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
}

export function Correlate({ sumpId, chartDetached, logDetached, onDetach }: CorrelateProps) {
  const view = useAtomValue(viewAtom);
  const setView = useSetAtom(viewAtom);
  const setCursorT = useSetAtom(cursorTAtom);
  const cursorT = useAtomValue(cursorTAtom);

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
  const [exportMessage, setExportMessage] = useState<string | null>(null);

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

      // Evaluate event rules on telemetry load
      if (page.records.length > 0) {
        const evals = await window.correlator.evaluateEventRules({
          sumpId,
          samples: page.records,
        });
        setEvalResults(evals);
      }
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  }, [sumpId, setView]);

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

  useEffect(() => {
    setCursorT(null);
    load();
    loadSession();
    loadEventRules();
  }, [load, loadSession, loadEventRules, setCursorT]);

  const handleStartSession = async () => {
    try {
      const res = await window.correlator.startRecordingSession({ sumpId });
      setSession(res);
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handlePauseSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.pauseRecordingSession({ sessionId: session.id });
      setSession(res);
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handleResumeSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.resumeRecordingSession({ sessionId: session.id });
      setSession(res);
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handleStopSession = async () => {
    if (!session) return;
    try {
      const res = await window.correlator.stopRecordingSession({ sessionId: session.id });
      setSession(res);
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  };

  const handleDismissInterrupted = async (sessionId: string) => {
    try {
      await window.correlator.dismissInterruptedSession({ sessionId });
      setInterrupted((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setState({ phase: "error", message: errorMessage(err) });
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
    setExportMessage(null);
  };

  const handleRangeSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapStartIso || !snapEndIso) return;
    const snap = captureRangeSnapshot(records, sumpId, snapStartIso, snapEndIso);
    setActiveSnapshot(snap);
    setExportMessage(null);
  };

  const handleCopySnapshot = async () => {
    if (!activeSnapshot) return;
    const text =
      viewFormat === "json"
        ? formatSnapshotJson(activeSnapshot, true)
        : formatSnapshotRaw(activeSnapshot);
    try {
      await navigator.clipboard.writeText(text);
      setExportMessage("Copied to clipboard!");
    } catch {
      setExportMessage("Failed to copy to clipboard.");
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
      setExportMessage(`Exported snapshot to ${res.filePath}`);
    } catch (err) {
      setExportMessage(`Export failed: ${errorMessage(err)}`);
    }
  };

  const chartContainerId = metricContainerIds(records)[0];
  const sessionStatus = session?.status ?? "idle";

  return (
    <div>
      {interrupted.map((intSess) => (
        <div
          key={intSess.id}
          role="alert"
          style={{ background: "#fff3cd", padding: "8px", marginBottom: "8px" }}
        >
          <strong>Notice:</strong> A previous recording session ({intSess.id}) was interrupted by
          process restart and has been paused.
          <button
            type="button"
            onClick={() => handleDismissInterrupted(intSess.id)}
            style={{ marginLeft: "12px" }}
          >
            Dismiss
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
        <button type="button" onClick={() => load()}>
          Refresh
        </button>

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

      <EventDensityLane recordTimestamps={toEventTimestamps(records)} />

      <div>
        {onDetach && (
          <button
            type="button"
            onClick={() => onDetach("chart", { sumpId, t0: view.t0, t1: view.t1, cursorT })}
            title="Detach chart into its own window"
            style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}
          >
            ⧉
          </button>
        )}
        {!chartDetached && <Chart points={toChartPoints(records, "cpu_pct", chartContainerId)} />}
      </div>

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
        {!logDetached && <LogPanel rows={toLogRows(records)} />}
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

            {exportMessage && (
              <p style={{ fontSize: "0.9em", color: "#0d6efd", marginBottom: "8px" }}>
                {exportMessage}
              </p>
            )}

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
