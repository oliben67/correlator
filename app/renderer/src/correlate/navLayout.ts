/**
 * Pure navigator layout (cor-CORE.CORRELATE-000011 §5): the extent the
 * track spans, where the view's thumb sits on it, and the views a click or
 * a thumb drag produce. Modelled on cttc's 14px navigator.
 */

import type { Viewport } from "./atoms.js";

/** The track always covers at least the last hour. */
export const NAV_MIN_HISTORY_MS = 60 * 60 * 1000;

/** From the earlier of the view's start and an hour ago, to the later of
 * the view's end and now. */
export function navExtent(view: Viewport, nowMs: number): Viewport {
  return {
    t0: Math.min(view.t0, nowMs - NAV_MIN_HISTORY_MS),
    t1: Math.max(view.t1, nowMs),
  };
}

/** The thumb as fractions (0..1) of the track. */
export function thumbLayout(view: Viewport, extent: Viewport): { left: number; width: number } {
  const span = extent.t1 - extent.t0 || 1;
  const left = Math.max(0, Math.min(1, (view.t0 - extent.t0) / span));
  const right = Math.max(0, Math.min(1, (view.t1 - extent.t0) / span));
  return { left, width: right - left };
}

/** The view centered on the time at `fraction` of the track, same span. */
export function centerAtFraction(view: Viewport, extent: Viewport, fraction: number): Viewport {
  const t = extent.t0 + fraction * (extent.t1 - extent.t0);
  const half = (view.t1 - view.t0) / 2;
  return { t0: t - half, t1: t + half };
}

/** The view after dragging the thumb by `fraction` of the track. */
export function dragThumb(start: Viewport, extent: Viewport, fraction: number): Viewport {
  const shift = fraction * (extent.t1 - extent.t0);
  return { t0: start.t0 + shift, t1: start.t1 + shift };
}
