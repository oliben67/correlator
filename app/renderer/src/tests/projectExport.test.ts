import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArchivedRecording, ArchivedTrack } from "../correlator-api.js";
import { DEFAULT_EXPORT_CHOICES, ExportWizardBody } from "../ExportWizard.js";
import {
  buildProjectExport,
  type ExportItem,
  exportFileName,
  exportToText,
  summarize,
} from "../projectExport.js";

// cor-CORE.EXPORT-000004 (REQ-000041): the Project-view export wizard.

const track: ArchivedTrack = {
  t0: 1_000,
  t1: 4_000,
  created: "2026-10-02T00:00:00Z",
  seriesName: "cpu_pct",
  points: [
    [1_000, 10],
    [2_000, 30],
    [4_000, 20],
  ],
  systemKind: "container",
};
const recording: ArchivedRecording = {
  t0: 500,
  t1: 3_000,
  created: "2026-10-02T00:00:00Z",
  sources: { api: [{ tsMs: 600, text: "hello\nsecond line" }] },
  systemKinds: { api: "container" },
};
const items: ExportItem[] = [
  { path: "/p/a.track", archive: { kind: "track", track } },
  { path: "/p/b.recording", archive: { kind: "recording", recording } },
];
const at = new Date("2026-10-02T12:00:00.000Z");

describe("cor-CORE.EXPORT-000004: buildProjectExport", () => {
  it("summarizes each track and lists each log source, over the union of ranges", () => {
    const data = buildProjectExport(
      items,
      { metrics: true, logs: true, granularity: "summary" },
      at,
    );
    expect(data).toEqual({
      generated_at: "2026-10-02T12:00:00.000Z",
      from: 500,
      to: 4_000,
      stats: {
        granularity: "summary",
        series: [
          {
            name: "cpu_pct",
            systemKind: "container",
            path: "/p/a.track",
            summary: { min: 10, avg: 20, max: 30, count: 3 },
          },
        ],
      },
      logs: [
        { source: "api", path: "/p/b.recording", rows: [{ ts: 600, text: "hello\nsecond line" }] },
      ],
    });
  });

  it("keeps the files' own timestamps and every point for a full export", () => {
    const data = buildProjectExport(items, { metrics: true, logs: false, granularity: "full" }, at);
    expect(data.stats?.series[0].points).toEqual(track.points);
    expect(data.logs).toBeUndefined();
    expect([data.from, data.to]).toEqual([1_000, 4_000]);
  });

  it("leaves out metrics when only logs are included", () => {
    const data = buildProjectExport(
      items,
      { metrics: false, logs: true, granularity: "summary" },
      at,
    );
    expect(data.stats).toBeUndefined();
    expect(data.logs).toHaveLength(1);
  });

  it("summarize gives null for no samples", () => {
    expect(summarize([])).toBeNull();
  });
});

describe("cor-CORE.EXPORT-000004: exportToText and file name", () => {
  it("writes cttc's layout: header, range, Stats blocks, Logs blocks (first line of each row)", () => {
    const text = exportToText(
      buildProjectExport(items, { metrics: true, logs: true, granularity: "summary" }, at),
    );
    expect(text).toBe(
      [
        "Correlator project export",
        "Generated: 2026-10-02T12:00:00.000Z",
        "Range: 1970-01-01T00:00:00.500Z → 1970-01-01T00:00:04.000Z",
        "",
        "== Stats (summary) ==",
        "[cpu_pct · container] /p/a.track",
        "min/avg/max: 10/20/30 (3 samples)",
        "",
        "== Logs ==",
        "[api] /p/b.recording",
        "1970-01-01T00:00:00.600Z hello",
        "",
      ].join("\n"),
    );
  });

  it("writes one line per point for a full series", () => {
    const text = exportToText(
      buildProjectExport(items, { metrics: true, logs: false, granularity: "full" }, at),
    );
    expect(text).toContain("== Stats (full time series) ==");
    expect(text).toContain("1970-01-01T00:00:02.000Z 30");
  });

  it("suggests project-export-<stamp>.json or .txt", () => {
    expect(exportFileName("json", at)).toBe("project-export-2026-10-02T12-00-00Z.json");
    expect(exportFileName("text", at)).toBe("project-export-2026-10-02T12-00-00Z.txt");
  });
});

describe("cor-CORE.EXPORT-000004: ExportWizardBody", () => {
  const render = (step: 1 | 2, choices = DEFAULT_EXPORT_CHOICES) =>
    renderToStaticMarkup(
      createElement(ExportWizardBody, {
        step,
        choices,
        onChange: () => {},
        onNext: () => {},
        onBack: () => {},
        onExport: () => {},
      }),
    );

  it("step 1 offers metrics and logs, both checked, and Next", () => {
    const markup = render(1);
    expect(markup).toMatch(/name="metrics" checked/);
    expect(markup).toMatch(/name="logs" checked/);
    expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>Next<\/button>/);
  });

  it("step 1 disables Next when nothing is included", () => {
    expect(render(1, { ...DEFAULT_EXPORT_CHOICES, metrics: false, logs: false })).toMatch(
      /<button[^>]*disabled[^>]*>Next<\/button>/,
    );
  });

  it("step 2 offers Text/JSON, and the metrics detail only when metrics are included", () => {
    const markup = render(2);
    expect(markup).toContain(">Text</button>");
    expect(markup).toContain(">JSON</button>");
    expect(markup).toContain("data-export-detail");
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Summary/);
    expect(render(2, { ...DEFAULT_EXPORT_CHOICES, metrics: false })).not.toContain(
      "data-export-detail",
    );
  });
});
