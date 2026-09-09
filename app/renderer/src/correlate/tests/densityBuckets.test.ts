import { describe, expect, it } from "vitest";
import type { Viewport } from "../atoms.js";
import { bucketize } from "../densityBuckets.js";

describe("cor-CORE.CORRELATE-003: bucketize", () => {
  const view: Viewport = { t0: 0, t1: 100 };

  it("distributes known timestamps into the expected buckets", () => {
    // 10 buckets of width 10 over [0, 100]
    const counts = bucketize([5, 5, 15, 99], view, 10);
    expect(counts).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("places a boundary timestamp in the correct adjacent bucket, not off-by-one", () => {
    // t=10 is the boundary between bucket 0 ([0,10)) and bucket 1 ([10,20)) -- belongs to bucket 1.
    const counts = bucketize([10], view, 10);
    expect(counts).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("includes view.t1 itself in the last bucket, not dropped or off the end", () => {
    const counts = bucketize([100], view, 10);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("excludes timestamps outside the view", () => {
    const counts = bucketize([-1, 101], view, 10);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
