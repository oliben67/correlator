import { describe, expect, it } from "vitest";
import { dragBand, resolveRelease, resolveWheel } from "../gestures.js";
import { LatestRequest, loadWindow } from "../liveView.js";
import {
  isClick,
  MAX_SPAN_MS,
  MIN_SPAN_MS,
  panBy,
  rangeView,
  wheelFactor,
  zoomAround,
} from "../zoom.js";

// cor-CORE.CORRELATE-000009 (REQ-000036): zoom math, gestures, live model.

const view = { t0: 0, t1: 60_000 };
const width = 600; // 100 ms per px

describe("cor-CORE.CORRELATE-000009: zoom math", () => {
  it("zoomAround keeps the anchor's time at the same place in the view", () => {
    const next = zoomAround(view, 15_000, 2);
    expect(next.t1 - next.t0).toBe(120_000);
    expect((15_000 - next.t0) / (next.t1 - next.t0)).toBeCloseTo(0.25);
  });

  it("zoomAround clamps the span to 200 ms .. 30 days", () => {
    const tiny = zoomAround(view, 30_000, 1e-9);
    expect(tiny.t1 - tiny.t0).toBe(MIN_SPAN_MS);
    const huge = zoomAround(view, 30_000, 1e9);
    expect(huge.t1 - huge.t0).toBe(MAX_SPAN_MS);
  });

  it("one wheel notch down zooms out 1.2x, up zooms in", () => {
    expect(wheelFactor(100)).toBeCloseTo(1.2);
    expect(wheelFactor(-100)).toBeCloseTo(1 / 1.2);
  });

  it("panBy shifts by a fraction of the span", () => {
    expect(panBy(view, 0.5)).toEqual({ t0: 30_000, t1: 90_000 });
    expect(panBy(view, -0.25)).toEqual({ t0: -15_000, t1: 45_000 });
  });

  it("rangeView orders the ends and ignores a range under 200 ms", () => {
    expect(rangeView(5_000, 1_000)).toEqual({ t0: 1_000, t1: 5_000 });
    expect(rangeView(1_000, 1_199)).toBeNull();
    expect(rangeView(1_000, 1_200)).toEqual({ t0: 1_000, t1: 1_200 });
  });

  it("under 6 px of travel is a click", () => {
    expect(isClick(100, 105)).toBe(true);
    expect(isClick(100, 94)).toBe(false);
  });
});

describe("cor-CORE.CORRELATE-000009: gestures", () => {
  it("a release within 6 px sets the cursor at the release point", () => {
    expect(resolveRelease({ x0: 100, x: 100 }, 103, view, width)).toEqual({
      type: "click",
      t: 10_300,
    });
  });

  it("a drag zooms to the dragged range, in either direction", () => {
    expect(resolveRelease({ x0: 300, x: 100 }, 100, view, width)).toEqual({
      type: "zoom",
      view: { t0: 10_000, t1: 30_000 },
    });
  });

  it("a drag shorter than 200 ms changes nothing", () => {
    // 1 ms per px: 7 px is a drag but only 7 ms.
    const narrow = { t0: 0, t1: 600 };
    expect(resolveRelease({ x0: 100, x: 107 }, 107, narrow, width)).toEqual({ type: "none" });
  });

  it("the band covers the drag once it passes the click threshold", () => {
    expect(dragBand(null)).toBeNull();
    expect(dragBand({ x0: 100, x: 103 })).toBeNull();
    expect(dragBand({ x0: 300, x: 100 })).toEqual({ left: 100, width: 200 });
  });

  it("a vertical wheel zooms around the pointer", () => {
    const next = resolveWheel({ deltaX: 0, deltaY: 100, shiftKey: false }, 150, view, width);
    expect(next?.t1 && next.t1 - next.t0).toBeCloseTo(72_000);
    // The time under the pointer (15 s) stays under the pointer (x = 150).
    expect(next && ((15_000 - next.t0) / (next.t1 - next.t0)) * width).toBeCloseTo(150);
  });

  it("a horizontal wheel or Shift+wheel pans by the scroll distance", () => {
    expect(resolveWheel({ deltaX: 60, deltaY: 0, shiftKey: false }, 0, view, width)).toEqual({
      t0: 6_000,
      t1: 66_000,
    });
    expect(resolveWheel({ deltaX: 0, deltaY: -60, shiftKey: true }, 0, view, width)).toEqual({
      t0: -6_000,
      t1: 54_000,
    });
  });

  it("a zero wheel delta changes nothing", () => {
    expect(resolveWheel({ deltaX: 0, deltaY: 0, shiftKey: false }, 0, view, width)).toBeNull();
  });
});

describe("cor-CORE.CORRELATE-000009: live model", () => {
  it("live ends the window at now and keeps the span; paused keeps the view", () => {
    expect(loadWindow({ t0: 0, t1: 10_000 }, true, 100_000)).toEqual({ t0: 90_000, t1: 100_000 });
    expect(loadWindow({ t0: 0, t1: 10_000 }, false, 100_000)).toEqual({ t0: 0, t1: 10_000 });
  });

  it("only the latest request is current", () => {
    const requests = new LatestRequest();
    const first = requests.next();
    const second = requests.next();
    expect(requests.isLatest(first)).toBe(false);
    expect(requests.isLatest(second)).toBe(true);
  });
});
