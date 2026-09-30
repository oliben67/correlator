import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArchivedRecording, ArchivedTrack, ProjectSummary } from "../correlator-api.js";
import { ProjectViewer } from "../ProjectViewer.js";
import {
  ArchiveLoader,
  type LoadedArchive,
  mergeRecordingRows,
  referenceKind,
  trackToChartPoints,
  unionRange,
  viewStateOf,
} from "../projectTracks.js";

// cor-CORE.PROJECT-000008 (REQ-000033): project track viewer.

const track: ArchivedTrack = {
  t0: 1000,
  t1: 3000,
  created: "",
  seriesName: "cpu_pct",
  points: [
    [1000, 10],
    [3000, 30],
  ],
  systemKind: "container",
};

const recording = (
  sources: ArchivedRecording["sources"],
  t0 = 0,
  t1 = 10_000,
): ArchivedRecording => ({
  t0,
  t1,
  created: "",
  sources,
  systemKinds: {},
});

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    path: "/p/work.correlator",
    name: "work",
    isDefault: false,
    mode: "unbound",
    context: null,
    references: ["/r/a.track", "/r/b.recording"],
    folders: [],
    trackSettings: {},
    ...overrides,
  };
}

describe("cor-CORE.PROJECT-000008: project track mapping", () => {
  it("classifies references by extension", () => {
    expect(referenceKind("/r/A.TRACK")).toBe("track");
    expect(referenceKind("/r/b.recording")).toBe("recording");
    expect(referenceKind("/r/c.json")).toBe("other");
  });

  it("reads a reference with no view-state as visible with no delay", () => {
    expect(viewStateOf(project(), "/r/a.track")).toEqual({ visible: true, delayMs: 0 });
    expect(
      viewStateOf(project({ trackSettings: { "/r/a.track": { visible: false } } }), "/r/a.track"),
    ).toEqual({ visible: false, delayMs: 0 });
  });

  it("shifts track points by the delay", () => {
    expect(trackToChartPoints(track, 500)).toEqual([
      { t: 1500, v: 10 },
      { t: 3500, v: 30 },
    ]);
  });

  it("merges recordings' sources in time order, each shifted by its delay, labelled by source", () => {
    const rows = mergeRecordingRows([
      {
        recording: recording({
          api: [
            { tsMs: 100, text: "a1" },
            { tsMs: 300, text: "a2" },
          ],
        }),
        delayMs: 0,
      },
      { recording: recording({ db: [{ tsMs: 100, text: "d1" }] }), delayMs: 100 },
    ]);
    expect(rows).toEqual([
      { ts: 100, message: "api: a1" },
      { ts: 200, message: "db: d1" },
      { ts: 300, message: "api: a2" },
    ]);
  });

  it("keeps equal timestamps in input order", () => {
    const rows = mergeRecordingRows([
      {
        recording: recording({ x: [{ tsMs: 5, text: "first" }], y: [{ tsMs: 5, text: "second" }] }),
        delayMs: 0,
      },
    ]);
    expect(rows.map((r) => r.message)).toEqual(["x: first", "y: second"]);
  });

  it("fits the union range of the given archives, delays included", () => {
    expect(unionRange([])).toBeNull();
    expect(
      unionRange([
        { archive: track, delayMs: -500 },
        { archive: recording({}, 2000, 9000), delayMs: 1000 },
      ]),
    ).toEqual({ t0: 500, t1: 10_000 });
    expect(unionRange([{ archive: { t0: 5, t1: 5 }, delayMs: 0 }])).toEqual({ t0: 5, t1: 1005 });
  });
});

describe("cor-CORE.PROJECT-000008: ProjectViewer", () => {
  const loaded: Record<string, LoadedArchive> = {
    "/r/a.track": { kind: "track", track },
    "/r/b.recording": {
      kind: "recording",
      recording: recording({ api: [{ tsMs: 100, text: "hello" }] }),
    },
  };
  const render = (p: ProjectSummary, archives = loaded) =>
    renderToStaticMarkup(
      createElement(ProjectViewer, {
        project: p,
        archives,
        onToggle: () => {},
        onDelay: () => {},
        onFit: () => {},
      }),
    );

  it("draws a strip per visible track and a merged log panel", () => {
    const markup = render(project({ trackSettings: { "/r/a.track": { delayMs: 250 } } }));
    expect(markup).toContain('data-strip="/r/a.track"');
    expect(markup).toContain("cpu_pct · container");
    expect(markup).toContain('data-logs="1"');
    expect(markup).toContain("api: hello");
    expect(markup).toContain('value="250"');
    expect(markup).toContain(">Fit</button>");
  });

  it("draws nothing for hidden references but still lists them", () => {
    const markup = render(
      project({
        trackSettings: { "/r/a.track": { visible: false }, "/r/b.recording": { visible: false } },
      }),
    );
    expect(markup).not.toContain("data-strip=");
    expect(markup).not.toContain("data-logs=");
    expect(markup).toContain('aria-label="Show a.track"');
    expect(markup).not.toMatch(/aria-label="Show a.track"[^>]*checked/);
  });

  it("lists an unreadable file with its error, without blocking the others", () => {
    const markup = render(project(), {
      ...loaded,
      "/r/a.track": { kind: "error", message: "ENOENT" },
    });
    expect(markup).toContain("read: ENOENT");
    expect(markup).toContain('data-logs="1"');
  });

  it("cor-CORE.CORRELATE-000010: shows the Analysis badge and a time axis on the last strip", () => {
    const markup = render(project());
    expect(markup).toContain('data-view-mode="analysis"');
    expect(markup).toMatch(/aria-label="cpu_pct · container" data-time-axis=""/);
  });

  it("renders nothing for a project with no tracks or recordings", () => {
    expect(render(project({ references: ["/r/c.json"] }))).toBe("");
  });
});

describe("BUG-000009: ArchiveLoader", () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("delivers a result that arrives after a later load call, reading each file once", async () => {
    const pending = deferred<ArchivedTrack>();
    let reads = 0;
    const results: [string, LoadedArchive][] = [];
    const loader = new ArchiveLoader(
      {
        readTrack: () => {
          reads++;
          return pending.promise;
        },
        readRecording: async () => recording({}),
      },
      (path, entry) => results.push([path, entry]),
    );
    loader.load(["/r/a.track"]);
    loader.load(["/r/a.track"]); // a re-render while the read is in flight
    pending.resolve(track);
    await flush();
    expect(reads).toBe(1);
    expect(results).toEqual([["/r/a.track", { kind: "track", track }]]);
  });

  it("reports a failing file as an error without blocking the others", async () => {
    const results: Record<string, LoadedArchive["kind"]> = {};
    const loader = new ArchiveLoader(
      {
        readTrack: async () => {
          throw new Error("ENOENT");
        },
        readRecording: async () => recording({}),
      },
      (path, entry) => {
        results[path] = entry.kind;
      },
    );
    loader.load(["/r/a.track", "/r/b.recording", "/r/c.json"]);
    await flush();
    expect(results).toEqual({ "/r/a.track": "error", "/r/b.recording": "recording" });
  });

  it("stops reporting after dispose (unmount)", async () => {
    const pending = deferred<ArchivedTrack>();
    const results: string[] = [];
    const loader = new ArchiveLoader(
      { readTrack: () => pending.promise, readRecording: async () => recording({}) },
      (path) => results.push(path),
    );
    loader.load(["/r/a.track"]);
    loader.dispose();
    pending.resolve(track);
    await flush();
    expect(results).toEqual([]);
  });
});
