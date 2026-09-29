import { useEffect, useRef, useState } from "react";
import type { ChartPoint } from "./correlate/chartDraw.js";
import type { LogRow } from "./correlate/LogPanel.js";
import type {
  ArchivedRecording,
  ArchivedTrack,
  ProjectSummary,
  TrackViewStateSummary,
} from "./correlator-api.js";

// cor-CORE.PROJECT-000008 (REQ-000033, RM-000040): render a project's own
// files. `.track` references become chart strips, `.recording` references
// one merged log panel, each shifted by its per-reference delay
// (cor-CORE.PROJECT-000005) -- a pure display transform, never a change to
// the file. Ported from cttc's "Add Track to View" + effectiveTimestamp.

export type ReferenceKind = "track" | "recording" | "other";

export function referenceKind(path: string): ReferenceKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".track")) return "track";
  if (lower.endsWith(".recording")) return "recording";
  return "other";
}

/** A reference with no view-state is visible with no delay. */
export function viewStateOf(
  project: ProjectSummary,
  path: string,
): Required<TrackViewStateSummary> {
  const state = project.trackSettings[path] ?? {};
  return { visible: state.visible ?? true, delayMs: state.delayMs ?? 0 };
}

export function trackToChartPoints(track: ArchivedTrack, delayMs: number): ChartPoint[] {
  return track.points.map(([t, v]) => ({ t: t + delayMs, v }));
}

export interface RecordingInput {
  recording: ArchivedRecording;
  delayMs: number;
}

/** Every source's rows, shifted by its recording's delay, labelled with the
 * source, in time order (stable for equal timestamps). */
export function mergeRecordingRows(inputs: readonly RecordingInput[]): LogRow[] {
  const rows: LogRow[] = [];
  for (const { recording, delayMs } of inputs) {
    for (const [source, sourceRows] of Object.entries(recording.sources)) {
      for (const row of sourceRows) {
        rows.push({ ts: row.tsMs + delayMs, message: `${source}: ${row.text}` });
      }
    }
  }
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => a.row.ts - b.row.ts || a.i - b.i)
    .map(({ row }) => row);
}

export interface TimeRange {
  t0: number;
  t1: number;
}

/** Union of the given archives' ranges, each shifted by its delay; null if none. */
export function unionRange(
  items: readonly { archive: { t0: number; t1: number }; delayMs: number }[],
): TimeRange | null {
  if (items.length === 0) return null;
  let t0 = Number.POSITIVE_INFINITY;
  let t1 = Number.NEGATIVE_INFINITY;
  for (const { archive, delayMs } of items) {
    t0 = Math.min(t0, archive.t0 + delayMs);
    t1 = Math.max(t1, archive.t1 + delayMs);
  }
  return t1 > t0 ? { t0, t1 } : { t0, t1: t0 + 1000 };
}

export type LoadedArchive =
  | { kind: "track"; track: ArchivedTrack }
  | { kind: "recording"; recording: ArchivedRecording }
  | { kind: "error"; message: string };

/** Reads every `.track`/`.recording` reference once per path (cached for the
 * component's life); a failing file becomes an error entry, never blocking
 * the others. */
export function useProjectArchives(references: readonly string[]): Record<string, LoadedArchive> {
  const [loaded, setLoaded] = useState<Record<string, LoadedArchive>>({});
  // Paths already asked for, so a re-render with the same references
  // (every project-changed push) never re-reads a file.
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    for (const path of references) {
      const kind = referenceKind(path);
      if (kind === "other" || requested.current.has(path)) continue;
      requested.current.add(path);
      const read =
        kind === "track"
          ? window.correlator
              .readTrackArchive(path)
              .then((track): LoadedArchive => ({ kind: "track", track }))
          : window.correlator
              .readRecordingArchive(path)
              .then((recording): LoadedArchive => ({ kind: "recording", recording }));
      read
        .catch(
          (err: unknown): LoadedArchive => ({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        )
        .then((entry) => {
          if (cancelled) {
            requested.current.delete(path); // let the next run retry it
            return;
          }
          setLoaded((prev) => ({ ...prev, [path]: entry }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [references]);

  return loaded;
}
