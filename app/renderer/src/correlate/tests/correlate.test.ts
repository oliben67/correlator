import { createStore } from "jotai/vanilla";
import { beforeEach, describe, expect, it } from "vitest";
import { cursorTAtom, liveAtom, viewAtom } from "../atoms.js";
import { recenterOn, resumeLive, type Store, setCursor, zoomTo } from "../correlate.js";

let store: Store;

beforeEach(() => {
  store = createStore();
  store.set(viewAtom, { t0: 0, t1: 60_000 });
});

describe("cor-CORE.CORRELATE-005: setCursor", () => {
  it("changes only cursorTAtom, leaving viewAtom unchanged", () => {
    const before = store.get(viewAtom);
    setCursor(store, 30_000);
    expect(store.get(cursorTAtom)).toBe(30_000);
    expect(store.get(viewAtom)).toEqual(before);
  });

  it("leaves live follow alone", () => {
    setCursor(store, 30_000);
    expect(store.get(liveAtom)).toBe(true);
  });
});

describe("cor-CORE.CORRELATE-005: recenterOn", () => {
  it("keeps the current span but centers the viewport on t, and sets the cursor to t", () => {
    recenterOn(store, 100_000);
    const view = store.get(viewAtom);
    expect(view.t1 - view.t0).toBe(60_000);
    expect(view.t0).toBe(100_000 - 30_000);
    expect(view.t1).toBe(100_000 + 30_000);
    expect(store.get(cursorTAtom)).toBe(100_000);
  });

  it("centers on t even when t is outside the current view (no clamping)", () => {
    recenterOn(store, 1_000_000);
    const view = store.get(viewAtom);
    expect(view.t0).toBe(1_000_000 - 30_000);
    expect(view.t1).toBe(1_000_000 + 30_000);
  });

  it("preserves a non-default span", () => {
    store.set(viewAtom, { t0: 0, t1: 10_000 });
    recenterOn(store, 50_000);
    const view = store.get(viewAtom);
    expect(view.t1 - view.t0).toBe(10_000);
    expect(view.t0).toBe(45_000);
    expect(view.t1).toBe(55_000);
  });
});

describe("cor-CORE.CORRELATE-000009: recenterOn, zoomTo and resumeLive", () => {
  it("recenterOn pauses live follow", () => {
    recenterOn(store, 100_000);
    expect(store.get(liveAtom)).toBe(false);
  });

  it("zoomTo sets the view and pauses live follow, leaving the cursor alone", () => {
    store.set(cursorTAtom, 5_000);
    zoomTo(store, { t0: 1_000, t1: 2_000 });
    expect(store.get(viewAtom)).toEqual({ t0: 1_000, t1: 2_000 });
    expect(store.get(liveAtom)).toBe(false);
    expect(store.get(cursorTAtom)).toBe(5_000);
  });

  it("resumeLive follows now again without moving the view itself", () => {
    zoomTo(store, { t0: 1_000, t1: 2_000 });
    resumeLive(store);
    expect(store.get(liveAtom)).toBe(true);
    expect(store.get(viewAtom)).toEqual({ t0: 1_000, t1: 2_000 });
  });
});
