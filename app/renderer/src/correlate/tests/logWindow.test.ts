import { describe, expect, it } from "vitest";
import { visibleRange } from "../logWindow.js";

describe("cor-CORE.CORRELATE-004: visibleRange", () => {
  it("returns the expected range for a mid-scroll position, including overscan", () => {
    // rowHeight=20, containerHeight=200 -> 10 rows visible, scrollTop=1000 -> starting at row 50
    const range = visibleRange(1000, 200, 20, 10_000, 10);
    expect(range).toEqual({ i0: 40, i1: 70 });
  });

  it("clamps i0 to 0 near the top", () => {
    const range = visibleRange(0, 200, 20, 10_000, 10);
    expect(range.i0).toBe(0);
  });

  it("clamps i1 to totalRows - 1 near the bottom", () => {
    const range = visibleRange(9_999_000, 200, 20, 100, 10);
    expect(range.i1).toBe(99);
  });

  it("never renders more rows than fit the window + overscan, regardless of totalRows", () => {
    const range = visibleRange(50_000_000, 200, 20, 100_000, 10);
    const rendered = range.i1 - range.i0 + 1;
    // 10 visible rows + 10 overscan each side = 30 max
    expect(rendered).toBeLessThanOrEqual(30);
  });

  it("handles zero total rows without going negative in a usable way", () => {
    const range = visibleRange(0, 200, 20, 0, 10);
    expect(range.i1).toBeLessThan(range.i0);
  });
});
