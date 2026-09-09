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
