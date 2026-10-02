import type { ArchivedRecording, ArchivedTrack } from "./correlator-api.js";

// cor-CORE.EXPORT-000004 (REQ-000041, RM-000044): flatten the Project view's
// visible, loaded files into one JSON or text export. Ported from cttc's
// Export Metrics wizard (app.js exportMetricsToText / gatherExportMetricsData),
// but built from the files already loaded -- no Sump round-trip. Timestamps
// are the files' own: per-reference delays only change the display.

export type ExportFormat = "json" | "text";
export type ExportGranularity = "summary" | "full";

export interface ExportItem {
  path: string;
  archive:
    | { kind: "track"; track: ArchivedTrack }
    | { kind: "recording"; recording: ArchivedRecording };
}

export interface ExportOptions {
  metrics: boolean;
  logs: boolean;
  granularity: ExportGranularity;
}

export interface SeriesSummary {
  min: number;
  avg: number;
  max: number;
  count: number;
}

export interface ExportedSeries {
  name: string;
  systemKind: string;
  path: string;
  summary?: SeriesSummary;
  points?: [number, number][];
}

export interface ProjectExport {
  generated_at: string;
  from: number;
  to: number;
  stats?: { granularity: ExportGranularity; series: ExportedSeries[] };
  logs?: { source: string; path: string; rows: { ts: number; text: string }[] }[];
}

export function summarize(points: readonly [number, number][]): SeriesSummary | null {
  if (points.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const [, v] of points) {
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }
  return { min, avg: sum / points.length, max, count: points.length };
}

/** The export of the included kinds, over the union of their ranges. */
export function buildProjectExport(
  items: readonly ExportItem[],
  options: ExportOptions,
  generatedAt: Date = new Date(),
): ProjectExport {
  const tracks = options.metrics
    ? items.flatMap((i) =>
        i.archive.kind === "track" ? [{ path: i.path, track: i.archive.track }] : [],
      )
    : [];
  const recordings = options.logs
    ? items.flatMap((i) =>
        i.archive.kind === "recording" ? [{ path: i.path, recording: i.archive.recording }] : [],
      )
    : [];
  const ranges = [...tracks.map((t) => t.track), ...recordings.map((r) => r.recording)];
  const result: ProjectExport = {
    generated_at: generatedAt.toISOString(),
    from: ranges.length ? Math.min(...ranges.map((r) => r.t0)) : 0,
    to: ranges.length ? Math.max(...ranges.map((r) => r.t1)) : 0,
  };
  if (options.metrics) {
    result.stats = {
      granularity: options.granularity,
      series: tracks.map(({ path, track }) => {
        const base = { name: track.seriesName, systemKind: track.systemKind, path };
        if (options.granularity === "full") return { ...base, points: track.points };
        return { ...base, summary: summarize(track.points) ?? undefined };
      }),
    };
  }
  if (options.logs) {
    result.logs = recordings.flatMap(({ path, recording }) =>
      Object.entries(recording.sources).map(([source, rows]) => ({
        source,
        path,
        rows: rows.map((r) => ({ ts: r.tsMs, text: r.text })),
      })),
    );
  }
  return result;
}

const iso = (ms: number) => new Date(ms).toISOString();
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** cttc's text layout: header, range, a Stats section, a Logs section. */
export function exportToText(data: ProjectExport): string {
  const lines = [
    "Correlator project export",
    `Generated: ${data.generated_at}`,
    `Range: ${iso(data.from)} → ${iso(data.to)}`,
    "",
  ];
  if (data.stats) {
    lines.push(
      `== Stats (${data.stats.granularity === "full" ? "full time series" : "summary"}) ==`,
    );
    for (const s of data.stats.series) {
      lines.push(`[${s.name} · ${s.systemKind}] ${s.path}`);
      if (s.points) {
        for (const [t, v] of s.points) lines.push(`${iso(t)} ${num(v)}`);
      } else if (s.summary) {
        const { min, avg, max, count } = s.summary;
        lines.push(`min/avg/max: ${num(min)}/${num(avg)}/${num(max)} (${count} samples)`);
      } else {
        lines.push("(no samples)");
      }
      lines.push("");
    }
  }
  if (data.logs) {
    lines.push("== Logs ==");
    for (const log of data.logs) {
      lines.push(`[${log.source}] ${log.path}`);
      for (const row of log.rows) lines.push(`${iso(row.ts)} ${row.text.split("\n")[0]}`);
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** `project-export-<stamp>.<ext>` -- the save dialog's suggested name. */
export function exportFileName(format: ExportFormat, at: Date = new Date()): string {
  const stamp = at
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/-\d{3}Z$/, "Z");
  return `project-export-${stamp}.${format === "json" ? "json" : "txt"}`;
}
