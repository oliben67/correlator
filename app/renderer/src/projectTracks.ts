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

export interface ArchiveReaders {
  readTrack: (path: string) => Promise<ArchivedTrack>;
  readRecording: (path: string) => Promise<ArchivedRecording>;
}

/**
 * Reads each `.track`/`.recording` path at most once and reports every
 * result, including one that arrives after later `load` calls (BUG-000009:
 * a re-render mid-read used to drop it). Only `dispose()` (unmount) stops
 * results from being reported. A failing file becomes an error entry and
 * never blocks the others (cor-CORE.PROJECT-000008 §5).
 */
export class ArchiveLoader {
  private readonly requested = new Set<string>();
  private disposed = false;

  constructor(
    private readonly readers: ArchiveReaders,
    private readonly onResult: (path: string, entry: LoadedArchive) => void,
  ) {}

  load(paths: readonly string[]): void {
    for (const path of paths) {
      const kind = referenceKind(path);
      if (kind === "other" || this.requested.has(path)) continue;
      this.requested.add(path);
      const read: Promise<LoadedArchive> =
        kind === "track"
          ? this.readers.readTrack(path).then((track) => ({ kind: "track", track }))
          : this.readers
              .readRecording(path)
              .then((recording) => ({ kind: "recording", recording }));
      read
        .catch(
          (err: unknown): LoadedArchive => ({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        )
        .then((entry) => {
          if (!this.disposed) this.onResult(path, entry);
        });
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** The current project's archives, keyed by path (cached for the component's life). */
export function useProjectArchives(references: readonly string[]): Record<string, LoadedArchive> {
  const [loaded, setLoaded] = useState<Record<string, LoadedArchive>>({});
  const loader = useRef<ArchiveLoader | null>(null);

  // One loader per mount; disposed only on unmount.
  useEffect(() => {
    const instance = new ArchiveLoader(
      {
        readTrack: (path) => window.correlator.readTrackArchive(path),
        readRecording: (path) => window.correlator.readRecordingArchive(path),
      },
      (path, entry) => setLoaded((prev) => ({ ...prev, [path]: entry })),
    );
    loader.current = instance;
    return () => instance.dispose();
  }, []);

  useEffect(() => {
    loader.current?.load(references);
  }, [references]);

  return loaded;
}
