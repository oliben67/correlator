import { describe, expect, it } from "vitest";
import type { Viewport } from "../atoms.js";
import { isHighlighted, tToX, xToT } from "../timeMapping.js";

describe("cor-CORE.CORRELATE-001: time<->pixel mapping", () => {
  const view: Viewport = { t0: 1_000, t1: 61_000 };
  const plotWidth = 600;

  it("round-trips x -> t -> x for representative values", () => {
    for (const x of [0, 1, 150, 300, 450, 599, 600]) {
      expect(tToX(xToT(x, view, plotWidth), view, plotWidth)).toBeCloseTo(x, 6);
    }
  });

  it("round-trips t -> x -> t for representative values", () => {
    for (const t of [1_000, 15_000, 31_000, 45_000, 61_000]) {
      expect(xToT(tToX(t, view, plotWidth), view, plotWidth)).toBeCloseTo(t, 6);
    }
  });

  it("maps x=0 to t0 and x=plotWidth to t1", () => {
    expect(xToT(0, view, plotWidth)).toBe(view.t0);
    expect(xToT(plotWidth, view, plotWidth)).toBe(view.t1);
  });
});

describe("cor-CORE.CORRELATE-001: isHighlighted", () => {
  it("is true exactly at cursorT +/- windowMs, inclusive", () => {
    expect(isHighlighted(10_000, 10_000, 5000)).toBe(true);
    expect(isHighlighted(15_000, 10_000, 5000)).toBe(true);
    expect(isHighlighted(5_000, 10_000, 5000)).toBe(true);
  });

  it("is false just outside the window", () => {
    expect(isHighlighted(15_001, 10_000, 5000)).toBe(false);
    expect(isHighlighted(4_999, 10_000, 5000)).toBe(false);
  });

  it("is false when cursorT is null", () => {
    expect(isHighlighted(10_000, null, 5000)).toBe(false);
  });
});
