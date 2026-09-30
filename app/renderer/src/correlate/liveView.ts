/**
 * The live/paused load model (cor-CORE.CORRELATE-000009 §4-§5): what range a
 * load queries, and a guard so only the latest request's result lands.
 */

import type { Viewport } from "./atoms.js";

/** Debounce before a moved (paused) view is re-queried. */
export const REFETCH_DEBOUNCE_MS = 250;

/** Live: end at now, keeping the span. Paused: the view as it is. */
export function loadWindow(view: Viewport, live: boolean, nowMs: number): Viewport {
  return live ? { t0: nowMs - (view.t1 - view.t0), t1: nowMs } : view;
}

/** Hands out request tickets; only the most recent one is current. */
export class LatestRequest {
  private latest = 0;

  next(): number {
    this.latest += 1;
    return this.latest;
  }

  isLatest(ticket: number): boolean {
    return ticket === this.latest;
  }
}
