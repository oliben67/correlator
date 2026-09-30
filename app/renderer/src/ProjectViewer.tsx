import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "./components/Button.js";
import { ModeBadge } from "./components/ModeBadge.js";
import { Panel } from "./components/Panel.js";
import { Chart } from "./correlate/Chart.js";
import { LogPanel } from "./correlate/LogPanel.js";
import type { ProjectSummary } from "./correlator-api.js";
import { referenceLabel } from "./project.js";
import {
  type LoadedArchive,
  mergeRecordingRows,
  referenceKind,
  trackToChartPoints,
  viewStateOf,
} from "./projectTracks.js";

// cor-CORE.PROJECT-000008 (RM-000040): the current project's own data --
// one chart strip per visible track, one merged log panel of the visible
// recordings -- with each reference's visibility and delay
// (cor-CORE.PROJECT-000005). Presentational: loading, saving and the
// shared viewport are the container's (ProjectView.tsx).

const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "2px 0" };

/** Commits a whole-millisecond delay on blur or Enter, not per keystroke. */
function DelayInput({ value, onCommit }: { value: number; onCommit: (ms: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const ms = Number(draft);
    if (Number.isInteger(ms) && ms !== value) onCommit(ms);
    else setDraft(String(value));
  };
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85em" }}>
      delay
      <input
        type="number"
        step={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        style={{ width: 90 }}
      />
      ms
    </label>
  );
}

export interface ProjectViewerProps {
  project: ProjectSummary;
  archives: Record<string, LoadedArchive>;
  onToggle: (path: string, visible: boolean) => void;
  onDelay: (path: string, delayMs: number) => void;
  onFit: () => void;
}

export function ProjectViewer({ project, archives, onToggle, onDelay, onFit }: ProjectViewerProps) {
  const renderable = project.references.filter((path) => referenceKind(path) !== "other");
  if (renderable.length === 0) return null;

  const strips: { path: string; label: string; points: ReturnType<typeof trackToChartPoints> }[] =
    [];
  const recordings: Parameters<typeof mergeRecordingRows>[0][number][] = [];
  for (const path of renderable) {
    const entry = archives[path];
    const { visible, delayMs } = viewStateOf(project, path);
    if (!visible || !entry) continue;
    if (entry.kind === "track") {
      strips.push({
        path,
        label: `${entry.track.seriesName} · ${entry.track.systemKind}`,
        points: trackToChartPoints(entry.track, delayMs),
      });
    } else if (entry.kind === "recording") {
      recordings.push({ recording: entry.recording, delayMs });
    }
  }
  const logRows = mergeRecordingRows(recordings);

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          View <ModeBadge mode="analysis" />
        </h3>
        <Button onClick={onFit}>Fit</Button>
      </div>
      <ul style={{ listStyle: "none", margin: "8px 0", padding: 0 }}>
        {renderable.map((path) => {
          const entry = archives[path];
          const { visible, delayMs } = viewStateOf(project, path);
          return (
            <li key={path} style={rowStyle} title={path}>
              <label
                style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => onToggle(path, e.target.checked)}
                  aria-label={`Show ${referenceLabel(path)}`}
                />
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {referenceKind(path) === "track" ? "📈" : "📜"} {referenceLabel(path)}
                </span>
              </label>
              {entry?.kind === "error" ? (
                <span data-error style={{ color: "var(--critical)", fontSize: "0.85em" }}>
                  Can't read: {entry.message}
                </span>
              ) : !entry ? (
                <span style={{ color: "var(--muted)", fontSize: "0.85em" }}>Loading…</span>
              ) : null}
              <DelayInput value={delayMs} onCommit={(ms) => onDelay(path, ms)} />
            </li>
          );
        })}
      </ul>
      {strips.map((strip, i) => (
        <div key={strip.path} data-strip={strip.path} style={{ marginTop: 8 }}>
          <div style={{ fontSize: "0.85em", color: "var(--muted)" }}>{strip.label}</div>
          <Chart points={strip.points} label={strip.label} timeAxis={i === strips.length - 1} />
        </div>
      ))}
      {logRows.length > 0 && (
        <div style={{ marginTop: 8 }} data-logs={logRows.length}>
          <LogPanel rows={logRows} />
        </div>
      )}
    </Panel>
  );
}
