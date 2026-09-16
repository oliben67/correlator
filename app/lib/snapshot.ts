/**
 * Telemetry snapshot capture and format helpers (cor-CORE.EXPORT-000001/-000002).
 */

import { randomUUID } from "node:crypto";
import type { SumpRecord } from "../renderer/src/correlator-api.d.ts";

export interface Snapshot {
  id: string;
  sumpId: string;
  startIso: string;
  endIso: string;
  records: SumpRecord[];
  capturedAt: string;
}

export function capturePointInTimeSnapshot(
  records: SumpRecord[],
  sumpId: string,
  cursorTMs: number,
  windowMs: number = 60000,
): Snapshot {
  const halfWindow = windowMs / 2;
  const startMs = cursorTMs - halfWindow;
  const endMs = cursorTMs + halfWindow;

  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();

  const filtered = records.filter((r) => {
    const t = new Date(r.ts).getTime();
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  return {
    id: `snap_${randomUUID()}`,
    sumpId,
    startIso,
    endIso,
    records: filtered,
    capturedAt: new Date().toISOString(),
  };
}

export function captureRangeSnapshot(
  records: SumpRecord[],
  sumpId: string,
  startIso: string,
  endIso: string,
): Snapshot {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const filtered = records.filter((r) => {
    const t = new Date(r.ts).getTime();
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  return {
    id: `snap_${randomUUID()}`,
    sumpId,
    startIso,
    endIso,
    records: filtered,
    capturedAt: new Date().toISOString(),
  };
}

export function formatSnapshotJson(snapshot: Snapshot, pretty: boolean = true): string {
  return JSON.stringify(snapshot.records, null, pretty ? 2 : undefined);
}

export function formatSnapshotRaw(snapshot: Snapshot): string {
  return snapshot.records
    .map((r) => {
      if (r.kind === "log") {
        const level = r.level ? ` [${r.level.toUpperCase()}]` : "";
        const host = r.docker_host ? ` (${r.docker_host})` : "";
        const msg = r.message ?? r.raw ?? "";
        return `${r.ts}${level}${host}: ${msg}`;
      }
      const host = r.docker_host ? ` (${r.docker_host})` : "";
      const cpu = r.cpu_pct !== undefined ? ` cpu=${r.cpu_pct.toFixed(1)}%` : "";
      const mem = r.mem_pct !== undefined ? ` mem=${r.mem_pct.toFixed(1)}%` : "";
      return `${r.ts} [METRIC]${host}:${cpu}${mem}`;
    })
    .join("\n");
}
