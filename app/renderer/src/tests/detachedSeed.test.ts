import { createStore } from "jotai/vanilla";
import { describe, expect, it } from "vitest";
import { cursorTAtom, liveAtom, viewAtom } from "../correlate/atoms.js";
import { seedDetachedState } from "../DetachedRoot.js";

// BUG-000011 regression: a detached window used to ignore its open-time
// state, start at the default view (epoch 0..60 s) with live follow on,
// and broadcast that default view back to the main window.

describe("BUG-000011: seedDetachedState", () => {
  it("starts from the opener's view, cursor and paused flag", () => {
    const store = createStore();
    seedDetachedState(store, { sumpId: "s", t0: 1_000, t1: 61_000, cursorT: 30_000, live: false });
    expect(store.get(viewAtom)).toEqual({ t0: 1_000, t1: 61_000 });
    expect(store.get(cursorTAtom)).toBe(30_000);
    expect(store.get(liveAtom)).toBe(false);
  });

  it("leaves the defaults alone for a missing or empty range", () => {
    const store = createStore();
    const before = store.get(viewAtom);
    seedDetachedState(store, { sumpId: "s", t0: 5_000 });
    seedDetachedState(store, { sumpId: "s", t0: 5_000, t1: 5_000 });
    expect(store.get(viewAtom)).toEqual(before);
    expect(store.get(liveAtom)).toBe(true);
    expect(store.get(cursorTAtom)).toBeNull();
  });
});
