import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SumpRecord } from "../../correlator-api.js";
import { ChartMenu, rangeCapture } from "../chartCapture.js";

// cor-CORE.EXPORT-000003 (REQ-000038): capture a range from the chart.

const log = (ts: string) => ({ kind: "log", ts, message: "m" }) as unknown as SumpRecord;

describe("cor-CORE.EXPORT-000003: rangeCapture", () => {
  it("gives the form's ISO bounds and a snapshot of the records inside the range", () => {
    const t0 = Date.parse("2026-09-30T10:00:00.000Z");
    const records = [
      log("2026-09-30T09:59:59.000Z"),
      log("2026-09-30T10:00:30.000Z"),
      log("2026-09-30T10:01:01.000Z"),
    ];
    const captured = rangeCapture(records, "s1", { t0, t1: t0 + 60_000 });
    expect(captured.startIso).toBe("2026-09-30T10:00:00.000Z");
    expect(captured.endIso).toBe("2026-09-30T10:01:00.000Z");
    expect(captured.snapshot.sumpId).toBe("s1");
    expect(captured.snapshot.startIso).toBe(captured.startIso);
    expect(captured.snapshot.records).toEqual([records[1]]);
  });
});

describe("cor-CORE.EXPORT-000003: ChartMenu", () => {
  it("offers exactly Capture range… and Snapshot at this time", () => {
    const markup = renderToStaticMarkup(
      createElement(ChartMenu, {
        left: 10,
        top: 20,
        onCaptureRange: () => {},
        onSnapshotHere: () => {},
      }),
    );
    const items = [...markup.matchAll(/role="menuitem"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(items).toEqual(["Capture range…", "Snapshot at this time"]);
    expect(markup).toContain('role="menu"');
  });
});
