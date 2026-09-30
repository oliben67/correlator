/**
 * The mutators of cor-CORE.CORRELATE-001's shared state
 * (cor-CORE.CORRELATE-005, with zoomTo/resumeLive from cor-CORE.CORRELATE-000009) -- every click handler in every component
 * calls one of these, never a component-local state update. Takes a
 * Jotai `Store` explicitly (not the implicit default store), matching
 * Phase 4's `shell.ts` dependency-injection precedent -- directly
 * testable with `createStore()` from `jotai/vanilla`, no component
 * rendering needed.
 */

import type { createStore } from "jotai/vanilla";
import {
  cursorTAtom,
  liveAtom,
  liveOptionsAtom,
  resumeAtAtom,
  type Viewport,
  viewAtom,
} from "./atoms.js";

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
export function recenterOn(store: Store, t: number, nowMs: number = Date.now()): void {
  const { t0, t1 } = store.get(viewAtom);
  const span = t1 - t0;
  const wasLive = store.get(liveAtom);
  store.set(viewAtom, { t0: t - span / 2, t1: t + span / 2 });
  store.set(cursorTAtom, t);
  store.set(liveAtom, false);
  // cor-CORE.CORRELATE-000011 §6: a recenter that interrupted live resumes it later.
  const delay = store.get(liveOptionsAtom).recenterResumeMs;
  if (wasLive && delay > 0) store.set(resumeAtAtom, nowMs + delay);
}

/** A zoom or pan gesture: move the view and pause live follow, cancelling
 * any pending resume. */
export function zoomTo(store: Store, view: Viewport): void {
  store.set(viewAtom, view);
  store.set(liveAtom, false);
  store.set(resumeAtAtom, null);
}

/** Follow now again; the view reloads (keeping its span). */
export function resumeLive(store: Store): void {
  store.set(liveAtom, true);
  store.set(resumeAtAtom, null);
}

/** The tick's check: resume live once a pending resume is due. */
export function checkResume(store: Store, nowMs: number): void {
  const at = store.get(resumeAtAtom);
  if (at === null || nowMs < at) return;
  if (store.get(liveAtom)) store.set(resumeAtAtom, null);
  else resumeLive(store);
}
