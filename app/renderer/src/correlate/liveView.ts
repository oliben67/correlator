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

/**
 * cor-CORE.CORRELATE-000011 §6: when going back to live should reload. The
 * view's own reset to live (opening it, switching its Sump) already runs its
 * own, reporting load, so that switch must not also fire a quiet reload that
 * supersedes it (BUG-000014). The reset calls `expectOwnReturn` only when it
 * actually flips a paused view; the next false -> true transition is then
 * swallowed once.
 */
export class LiveReturnTracker {
  private ownReturnPending = false;

  constructor(private wasLive: boolean) {}

  expectOwnReturn(): void {
    this.ownReturnPending = true;
  }

  /** Whether `live` just turned on from elsewhere (and so should reload). */
  observe(live: boolean): boolean {
    const turnedOn = live && !this.wasLive;
    this.wasLive = live;
    if (turnedOn && this.ownReturnPending) {
      this.ownReturnPending = false;
      return false;
    }
    return turnedOn;
  }
}
