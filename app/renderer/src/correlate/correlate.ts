/**
 * The two mutators of cor-CORE.CORRELATE-001's shared state
 * (cor-CORE.CORRELATE-005) -- every click handler in every component
 * calls one of these, never a component-local state update. Takes a
 * Jotai `Store` explicitly (not the implicit default store), matching
 * Phase 4's `shell.ts` dependency-injection precedent -- directly
 * testable with `createStore()` from `jotai/vanilla`, no component
 * rendering needed.
 */

import type { createStore } from "jotai/vanilla";
import { cursorTAtom, viewAtom } from "./atoms.js";

// jotai/vanilla's Store type isn't re-exported from its public barrel
// (only createStore/getDefaultStore are) -- derive it from createStore's
// own return type instead of reaching into an internal module path.
export type Store = ReturnType<typeof createStore>;

/** A chart/lane click: move the cursor, leave the viewport alone. */
export function setCursor(store: Store, t: number): void {
  store.set(cursorTAtom, t);
}

/**
 * A log-row click: keep the current viewport span, but move the window
 * so `t` is centered, and set the cursor to `t` too -- cttc's "click a
 * log line -> the chart recenters/highlights on that timestamp."
 */
export function recenterOn(store: Store, t: number): void {
  const { t0, t1 } = store.get(viewAtom);
  const span = t1 - t0;
  store.set(viewAtom, { t0: t - span / 2, t1: t + span / 2 });
  store.set(cursorTAtom, t);
}
