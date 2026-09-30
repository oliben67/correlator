/**
 * The live/paused load model (cor-CORE.CORRELATE-000009 §4-§5): what range a
 * load queries, and a guard so only the latest request's result lands.
 */

import type { Viewport } from "./atoms.js";

/** Debounce before a moved (paused) view is re-queried. */
export const REFETCH_DEBOUNCE_MS = 250;

/** Where now sits in a live view (cor-CORE.CORRELATE-000011 §4), so the
 * now line stays visible between loads. */
export const LIVE_NOW_FRACTION = 0.95;

/** Live: now at 95% of the span, keeping the span. Paused: the view as it is. */
export function loadWindow(view: Viewport, live: boolean, nowMs: number): Viewport {
  if (!live) return view;
  const span = view.t1 - view.t0;
  const t0 = nowMs - span * LIVE_NOW_FRACTION;
  return { t0, t1: t0 + span };
}

/** Where the live-track marker is drawn, or null when it isn't. */
export function liveTrackTime(
  nowMs: number | null,
  live: boolean,
  options: { liveTrackEnabled: boolean; liveTrackOffsetMs: number },
): number | null {
  if (nowMs === null || !live || !options.liveTrackEnabled) return null;
  return nowMs + options.liveTrackOffsetMs;
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
