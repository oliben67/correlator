/**
 * Pure viewport math for zoom and pan (cor-CORE.CORRELATE-000009). The drag
 * thresholds are cttc's (`app.js` drag-zoom: 6px click threshold, 200 ms
 * minimum span); wheel zoom and pan are new -- cttc has neither.
 */

import type { Viewport } from "./atoms.js";

/** A press and release closer than this (px) is a click, not a drag. */
export const CLICK_THRESHOLD_PX = 6;
export const MIN_SPAN_MS = 200;
export const MAX_SPAN_MS = 30 * 24 * 60 * 60 * 1000;
/** Zoom factor per wheel notch. */
export const WHEEL_ZOOM_STEP = 1.2;
/** Pixels of wheel delta treated as one notch. */
const WHEEL_NOTCH_PX = 100;

function clampSpan(span: number): number {
  return Math.min(MAX_SPAN_MS, Math.max(MIN_SPAN_MS, span));
}

/** Scale the span by `factor` (>1 zooms out) keeping `anchorT` at the same
 * relative position in the view. */
export function zoomAround(view: Viewport, anchorT: number, factor: number): Viewport {
  const span = view.t1 - view.t0;
  const next = clampSpan(span * factor);
  const frac = span > 0 ? (anchorT - view.t0) / span : 0.5;
  const t0 = anchorT - frac * next;
  return { t0, t1: t0 + next };
}

/** Zoom factor for a vertical wheel delta: scrolling down (positive) zooms out. */
export function wheelFactor(deltaY: number): number {
  return WHEEL_ZOOM_STEP ** (deltaY / WHEEL_NOTCH_PX);
}

/** Shift the view by `fraction` of its span (positive = later). */
export function panBy(view: Viewport, fraction: number): Viewport {
  const shift = (view.t1 - view.t0) * fraction;
  return { t0: view.t0 + shift, t1: view.t1 + shift };
}

/** The view a drag between two times zooms to, or null when the range is
 * under the minimum span (the drag is ignored). */
export function rangeView(ta: number, tb: number): Viewport | null {
  const t0 = Math.min(ta, tb);
  const t1 = Math.max(ta, tb);
  return t1 - t0 < MIN_SPAN_MS ? null : { t0, t1 };
}

export function isClick(x0: number, x1: number): boolean {
  return Math.abs(x1 - x0) < CLICK_THRESHOLD_PX;
}
