import { describe, expect, it, vi } from "vitest";
import type { Viewport } from "../atoms.js";
import { type CanvasLike, drawChartStrip } from "../chartDraw.js";

function fakeCtx(): CanvasLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    clearRect: vi.fn((...args: number[]) => calls.push(`clearRect(${args.join(",")})`)),
    beginPath: vi.fn(() => calls.push("beginPath")),
    moveTo: vi.fn((x: number, y: number) => calls.push(`moveTo(${x},${y})`)),
    lineTo: vi.fn((x: number, y: number) => calls.push(`lineTo(${x},${y})`)),
    stroke: vi.fn(() => calls.push("stroke")),
    arc: vi.fn((x: number, y: number) => calls.push(`arc(${x},${y})`)),
    fill: vi.fn(() => calls.push("fill")),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push(`fillText(${text},${x},${y})`),
    ),
    setLineDash: vi.fn((segments: number[]) => calls.push(`setLineDash(${segments.join(",")})`)),
  };
}

const view: Viewport = { t0: 0, t1: 100_000 };
const plotWidth = 500;
const height = 100;

describe("cor-CORE.CORRELATE-002: drawChartStrip", () => {
  it("draws a continuous path (moveTo + lineTo*) for adjacent in-range points, no dot", () => {
    const ctx = fakeCtx();
    drawChartStrip(ctx, {
      view,
      plotWidth,
      height,
      cursorT: null,
      gapLimitPx: 40,
      points: [
        { t: 0, v: 1 },
        { t: 1_000, v: 2 },
        { t: 2_000, v: 3 },
      ],
    });

    expect(ctx.calls.filter((c) => c.startsWith("moveTo")).length).toBe(1);
    expect(ctx.calls.filter((c) => c.startsWith("lineTo")).length).toBe(2);
    expect(ctx.calls.filter((c) => c.startsWith("arc"))).toHaveLength(0);
    expect(ctx.calls.filter((c) => c === "fill")).toHaveLength(0);
  });

  it("draws a dot (arc + fill), not a connecting line, for a point isolated beyond gapLimit", () => {
    const ctx = fakeCtx();
    drawChartStrip(ctx, {
      view,
      plotWidth,
      height,
      cursorT: null,
      gapLimitPx: 5,
      points: [
        { t: 0, v: 1 },
        { t: 90_000, v: 2 }, // 450px away at this view/width -- far beyond a 5px gap limit
      ],
    });

    expect(ctx.calls.filter((c) => c.startsWith("arc"))).toHaveLength(2);
    expect(ctx.calls.filter((c) => c === "fill")).toHaveLength(2);
    expect(ctx.calls.filter((c) => c.startsWith("lineTo"))).toHaveLength(0);
  });

  it("draws the cursor line only when cursorT falls within the view", () => {
    const inView = fakeCtx();
    drawChartStrip(inView, {
      view,
      plotWidth,
      height,
      cursorT: 50_000,
      points: [],
    });
    expect(inView.calls.filter((c) => c.startsWith("moveTo"))).toHaveLength(1);
    expect(inView.calls.filter((c) => c === "stroke")).toHaveLength(1);

    const outOfView = fakeCtx();
    drawChartStrip(outOfView, {
      view,
      plotWidth,
      height,
      cursorT: 150_000,
      points: [],
    });
    expect(outOfView.calls.filter((c) => c.startsWith("moveTo"))).toHaveLength(0);

    const noCursor = fakeCtx();
    drawChartStrip(noCursor, {
      view,
      plotWidth,
      height,
      cursorT: null,
      points: [],
    });
    expect(noCursor.calls.filter((c) => c.startsWith("moveTo"))).toHaveLength(0);
  });
});

// cor-CORE.CORRELATE-000007 (REQ-000034): several colored series per strip.
describe("cor-CORE.CORRELATE-000007: multi-series drawChartStrip", () => {
  function styledCtx() {
    const ctx = fakeCtx();
    let stroke: unknown;
    Object.defineProperty(ctx, "strokeStyle", {
      get: () => stroke,
      set: (v) => {
        stroke = v;
        ctx.calls.push(`strokeStyle=${v}`);
      },
    });
    return ctx;
  }
  // 10 s apart = 25 px at this view/width: within the 40 px gap limit.
  const pts = (v0: number, v1: number) => [
    { t: 10_000, v: v0 },
    { t: 15_000, v: v1 },
  ];

  it("draws each series in its own color and never joins points of different series", () => {
    const ctx = styledCtx();
    drawChartStrip(ctx, {
      view,
      plotWidth,
      height,
      cursorT: null,
      minValue: 0,
      maxValue: 100,
      series: [
        { color: "red", points: pts(0, 100) },
        { color: "blue", points: pts(50, 50) },
      ],
    });
    expect(ctx.calls).toEqual([
      "clearRect(0,0,500,100)",
      "strokeStyle=red",
      "beginPath",
      "moveTo(50,100)",
      "lineTo(75,0)",
      "stroke",
      "strokeStyle=blue",
      "beginPath",
      "moveTo(50,50)",
      "lineTo(75,50)",
      "stroke",
    ]);
  });

  it("shares one value range across series", () => {
    const ctx = styledCtx();
    drawChartStrip(ctx, {
      view,
      plotWidth,
      height,
      cursorT: null,
      series: [
        { color: "a", points: pts(0, 10) },
        { color: "b", points: pts(20, 20) },
      ],
    });
    // range 0..20: series a's 10 sits mid-strip, series b's 20 at the top
    expect(ctx.calls).toContain("lineTo(75,50)");
    expect(ctx.calls).toContain("lineTo(75,0)");
  });

  it("draws the cursor after every series, in its own color", () => {
    const ctx = styledCtx();
    drawChartStrip(ctx, {
      view,
      plotWidth,
      height,
      cursorT: 50_000,
      cursorColor: "grey",
      series: [{ color: "red", points: [{ t: 10_000, v: 1 }] }],
    });
    expect(ctx.calls.slice(-5)).toEqual([
      "strokeStyle=grey",
      "beginPath",
      "moveTo(250,0)",
      "lineTo(250,100)",
      "stroke",
    ]);
  });
});

// cor-CORE.CORRELATE-000010 (REQ-000037): gutter, gridlines, time axis.
describe("cor-CORE.CORRELATE-000010: axes in drawChartStrip", () => {
  const base = { view, plotWidth: 540, height: 100, minValue: 0, maxValue: 100 };
  const points = [
    { t: 0, v: 0 },
    { t: 5_000, v: 100 },
  ];

  it("maps time through the plot area right of the gutter", () => {
    const ctx = fakeCtx();
    drawChartStrip(ctx, { ...base, marginLeft: 40, cursorT: 50_000, points });
    // Plot area is 500px wide starting at x = 40: t0 -> 40, 50 s -> 290.
    expect(ctx.calls).toContain("moveTo(40,100)");
    expect(ctx.calls).toContain("moveTo(290,0)");
  });

  it("draws dashed gridlines at 100% and 50%, and value labels with the unit", () => {
    const ctx = fakeCtx();
    drawChartStrip(ctx, { ...base, marginLeft: 40, cursorT: null, points, unit: "%" });
    expect(ctx.calls.slice(1, 10)).toEqual([
      "setLineDash(2,3)",
      "beginPath",
      "moveTo(40,0.5)",
      "lineTo(540,0.5)",
      "stroke",
      "beginPath",
      "moveTo(40,50)",
      "lineTo(540,50)",
      "stroke",
    ]);
    expect(ctx.calls).toContain("setLineDash()");
    expect(ctx.calls).toContain("fillText(100%,36,0)");
    expect(ctx.calls).toContain("fillText(50%,36,50)");
    expect(ctx.calls).toContain("fillText(0%,36,100)");
  });

  it("draws no gridlines or labels without a gutter, or without data", () => {
    const bare = fakeCtx();
    drawChartStrip(bare, { ...base, cursorT: null, points });
    expect(bare.calls.some((c) => c.startsWith("setLineDash") || c.startsWith("fillText"))).toBe(
      false,
    );
    const empty = fakeCtx();
    drawChartStrip(empty, { ...base, marginLeft: 40, cursorT: null, points: [] });
    expect(empty.calls).toEqual(["clearRect(0,0,540,100)"]);
  });

  it("draws time ticks below the plot only when an axis height is given", () => {
    const ctx = fakeCtx();
    drawChartStrip(ctx, { ...base, marginLeft: 40, axisHeight: 16, cursorT: 50_000, points });
    // The plot is 84px tall; ticks sit at y = 84 and the cursor stops there.
    const labels = ctx.calls.filter((c) => c.startsWith("fillText") && c.endsWith(",87)"));
    expect(labels.length).toBeGreaterThan(0);
    expect(ctx.calls).toContain("lineTo(290,84)");
    const noAxis = fakeCtx();
    drawChartStrip(noAxis, { ...base, marginLeft: 40, cursorT: null, points });
    expect(noAxis.calls.filter((c) => c.startsWith("fillText"))).toHaveLength(3);
  });
});
