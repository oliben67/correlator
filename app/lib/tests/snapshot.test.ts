import { describe, expect, it } from "vitest";
import type { SumpRecord } from "../../renderer/src/correlator-api.d.ts";
import {
  capturePointInTimeSnapshot,
  captureRangeSnapshot,
  formatSnapshotJson,
  formatSnapshotRaw,
} from "../snapshot.ts";

describe("Snapshot helpers", () => {
  const mockRecords: SumpRecord[] = [
    {
      kind: "log",
      ts: "2026-09-16T10:00:00.000Z",
      seq: 1,
      docker_host: "h1",
      level: "info",
      message: "Log line 1",
    },
    {
      kind: "metric",
      ts: "2026-09-16T10:00:30.000Z",
      seq: 2,
      docker_host: "h1",
      cpu_pct: 45.2,
      mem_pct: 60.1,
    },
    {
      kind: "log",
      ts: "2026-09-16T10:05:00.000Z",
      seq: 3,
      docker_host: "h1",
      level: "error",
      message: "Log line 2",
    },
  ];

  it("captures point-in-time snapshot around a cursor timestamp", () => {
    const cursorMs = new Date("2026-09-16T10:00:15.000Z").getTime();
    const snap = capturePointInTimeSnapshot(mockRecords, "sump-1", cursorMs, 60000); // +/- 30s
    expect(snap.records).toHaveLength(2);
    expect(snap.records[0].ts).toBe("2026-09-16T10:00:00.000Z");
    expect(snap.records[1].ts).toBe("2026-09-16T10:00:30.000Z");
  });

  it("captures explicit time-range snapshot", () => {
    const snap = captureRangeSnapshot(
      mockRecords,
      "sump-1",
      "2026-09-16T10:00:20.000Z",
      "2026-09-16T10:06:00.000Z",
    );
    expect(snap.records).toHaveLength(2);
    expect(snap.records[0].ts).toBe("2026-09-16T10:00:30.000Z");
    expect(snap.records[1].ts).toBe("2026-09-16T10:05:00.000Z");
  });

  it("formats snapshot as formatted JSON string", () => {
    const snap = captureRangeSnapshot(
      mockRecords,
      "sump-1",
      "2026-09-16T10:00:00.000Z",
      "2026-09-16T10:00:10.000Z",
    );
    const jsonStr = formatSnapshotJson(snap, true);
    expect(jsonStr).toContain('"Log line 1"');
    expect(JSON.parse(jsonStr)).toHaveLength(1);
  });

  it("formats snapshot as raw text lines", () => {
    const snap = captureRangeSnapshot(
      mockRecords,
      "sump-1",
      "2026-09-16T10:00:00.000Z",
      "2026-09-16T10:01:00.000Z",
    );
    const rawStr = formatSnapshotRaw(snap);
    expect(rawStr).toContain("2026-09-16T10:00:00.000Z [INFO] (h1): Log line 1");
    expect(rawStr).toContain("2026-09-16T10:00:30.000Z [METRIC] (h1): cpu=45.2% mem=60.1%");
  });
});
