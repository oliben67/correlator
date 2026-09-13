import { describe, expect, it } from "vitest";
import type { LogRecord, MetricRecord, SumpRecord } from "../../correlator-api.js";
import {
  defaultWindow,
  epochMsToIso,
  metricContainerIds,
  toChartPoints,
  toEventTimestamps,
  toLogRows,
  tsToEpochMs,
} from "../recordMapping.js";

function log(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    kind: "log",
    docker_host: "h1",
    ts: "2026-09-12T00:00:00.000Z",
    seq: 1,
    ...overrides,
  };
}

function metric(overrides: Partial<MetricRecord> = {}): MetricRecord {
  return {
    kind: "metric",
    docker_host: "h1",
    ts: "2026-09-12T00:00:00.000Z",
    seq: 1,
    ...overrides,
  };
}

describe("cor-CORE.CORRELATE-006: tsToEpochMs / epochMsToIso", () => {
  it("round-trip exactly for a known ISO timestamp", () => {
    const iso = "2026-09-12T00:00:00.000Z";
    expect(epochMsToIso(tsToEpochMs(iso))).toBe(iso);
  });

  it("tsToEpochMs matches Date.parse", () => {
    expect(tsToEpochMs("2026-09-12T00:00:00.000Z")).toBe(Date.parse("2026-09-12T00:00:00.000Z"));
  });
});

describe("cor-CORE.CORRELATE-006: defaultWindow", () => {
  it("returns a 15-minute-wide window ending at nowMs by default", () => {
    const now = 1_000_000_000;
    expect(defaultWindow(now)).toEqual({ t0: now - 15 * 60 * 1000, t1: now });
  });

  it("is deterministic for a given nowMs and honors a custom span", () => {
    expect(defaultWindow(1000, 500)).toEqual({ t0: 500, t1: 1000 });
    expect(defaultWindow(1000, 500)).toEqual(defaultWindow(1000, 500));
  });
});

describe("cor-CORE.CORRELATE-006: toLogRows / toEventTimestamps", () => {
  const records: SumpRecord[] = [
    log({ ts: "2026-09-12T00:00:01.000Z", container_name: "web", level: "error", message: "boom" }),
    metric({ ts: "2026-09-12T00:00:02.000Z", cpu_pct: 12.5 }),
    log({ ts: "2026-09-12T00:00:03.000Z", container_id: "abc123", raw: "raw line" }),
  ];

  it("toLogRows only includes log records, formatted with level/who", () => {
    const rows = toLogRows(records);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ts: tsToEpochMs("2026-09-12T00:00:01.000Z"),
      message: "[error] web: boom",
    });
    expect(rows[1]).toEqual({
      ts: tsToEpochMs("2026-09-12T00:00:03.000Z"),
      message: "abc123: raw line",
    });
  });

  it("falls back to docker_host when no container name/id is present", () => {
    const rows = toLogRows([log({ message: "hi" })]);
    expect(rows[0].message).toBe("h1: hi");
  });

  it("toEventTimestamps only includes log-record timestamps, excluding metrics", () => {
    expect(toEventTimestamps(records)).toEqual([
      tsToEpochMs("2026-09-12T00:00:01.000Z"),
      tsToEpochMs("2026-09-12T00:00:03.000Z"),
    ]);
  });
});

describe("cor-CORE.CORRELATE-006: metricContainerIds", () => {
  it("returns metric-record container ids in first-seen order, deduplicated", () => {
    const records: SumpRecord[] = [
      metric({ container_id: "a" }),
      log({ container_id: "z" }),
      metric({ container_id: "b" }),
      metric({ container_id: "a" }),
    ];
    expect(metricContainerIds(records)).toEqual(["a", "b"]);
  });

  it("falls back to container_name when container_id is absent", () => {
    expect(metricContainerIds([metric({ container_name: "web" })])).toEqual(["web"]);
  });

  it("returns an empty array when no metric records have a container identity", () => {
    expect(metricContainerIds([metric({}), log({ container_id: "x" })])).toEqual([]);
  });
});

describe("cor-CORE.CORRELATE-006: toChartPoints", () => {
  const records: SumpRecord[] = [
    metric({ ts: "2026-09-12T00:00:02.000Z", container_id: "a", cpu_pct: 20 }),
    metric({ ts: "2026-09-12T00:00:01.000Z", container_id: "a", cpu_pct: 10 }),
    metric({ ts: "2026-09-12T00:00:01.500Z", container_id: "b", cpu_pct: 99 }),
    metric({ ts: "2026-09-12T00:00:03.000Z", container_id: "a", mem_pct: 5 }), // no cpu_pct
    log({ ts: "2026-09-12T00:00:04.000Z", container_id: "a" }),
  ];

  it("defaults to cpu_pct, filters to one container, excludes missing values, sorts by time", () => {
    const points = toChartPoints(records, "cpu_pct", "a");
    expect(points).toEqual([
      { t: tsToEpochMs("2026-09-12T00:00:01.000Z"), v: 10 },
      { t: tsToEpochMs("2026-09-12T00:00:02.000Z"), v: 20 },
    ]);
  });

  it("reads a different metric field when given one", () => {
    const points = toChartPoints(records, "mem_pct", "a");
    expect(points).toEqual([{ t: tsToEpochMs("2026-09-12T00:00:03.000Z"), v: 5 }]);
  });

  it("includes every container's points when no containerId filter is given", () => {
    const points = toChartPoints(records, "cpu_pct");
    expect(points.map((p) => p.v).sort()).toEqual([10, 20, 99]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(toChartPoints(records, "cpu_pct", "no-such-container")).toEqual([]);
  });
});
