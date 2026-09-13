/**
 * The `SumpRecord[]` (wire shape, string ISO-8601 `ts`) <-> correlation
 * engine shape (epoch-ms numbers) boundary (cor-CORE.CORRELATE-006).
 * Pure functions only, no IPC/`Date.now()` inside -- `nowMs` is always
 * passed in, matching `correlate.ts`'s own dependency-injection style.
 */

import type { LogRecord, MetricRecord, SumpRecord } from "../correlator-api.js";
import type { Viewport } from "./atoms.js";
import type { ChartPoint } from "./chartDraw.js";
import type { LogRow } from "./LogPanel.js";

export function tsToEpochMs(ts: string): number {
  return new Date(ts).getTime();
}

export function epochMsToIso(ms: number): string {
  return new Date(ms).toISOString();
}

const DEFAULT_SPAN_MS = 15 * 60 * 1000;

export function defaultWindow(nowMs: number, spanMs: number = DEFAULT_SPAN_MS): Viewport {
  return { t0: nowMs - spanMs, t1: nowMs };
}

function isLogRecord(record: SumpRecord): record is LogRecord {
  return record.kind === "log";
}

function isMetricRecord(record: SumpRecord): record is MetricRecord {
  return record.kind === "metric";
}

export function toLogRows(records: SumpRecord[]): LogRow[] {
  return records.filter(isLogRecord).map((record) => {
    const who = record.container_name ?? record.container_id ?? record.docker_host;
    const level = record.level ? `[${record.level}] ` : "";
    const body = record.message ?? record.raw ?? "";
    return { ts: tsToEpochMs(record.ts), message: `${level}${who}: ${body}` };
  });
}

export function toEventTimestamps(records: SumpRecord[]): number[] {
  return records.filter(isLogRecord).map((record) => tsToEpochMs(record.ts));
}

export type MetricField =
  | "cpu_pct"
  | "mem_pct"
  | "mem_used_bytes"
  | "mem_limit_bytes"
  | "net_rx_bytes"
  | "net_tx_bytes"
  | "blk_read_bytes"
  | "blk_write_bytes"
  | "pids";

/** First-seen order, deduplicated -- the containers actually reporting
 * metrics in this batch, cheapest possible default for "pick one". */
export function metricContainerIds(records: SumpRecord[]): string[] {
  const seen: string[] = [];
  for (const record of records) {
    if (!isMetricRecord(record)) continue;
    const id = record.container_id ?? record.container_name;
    if (id && !seen.includes(id)) seen.push(id);
  }
  return seen;
}

/**
 * `field` values for one container only, sorted by time. Filtering to a
 * single container is deliberate, not incidental: `drawChartStrip`
 * connects consecutive points in array order with gap-bridging, so an
 * unfiltered multi-container series would visually zigzag-connect
 * unrelated containers' values whenever they land within `gapLimitPx` of
 * each other -- a real correctness bug, not a style choice.
 */
export function toChartPoints(
  records: SumpRecord[],
  field: MetricField = "cpu_pct",
  containerId?: string,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const record of records) {
    if (!isMetricRecord(record)) continue;
    const id = record.container_id ?? record.container_name;
    if (containerId !== undefined && id !== containerId) continue;
    const v = record[field];
    if (typeof v !== "number") continue;
    points.push({ t: tsToEpochMs(record.ts), v });
  }
  return points.sort((a, b) => a.t - b.t);
}
