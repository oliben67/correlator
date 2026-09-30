/**
 * Pure gesture resolution for chart strips and lanes
 * (cor-CORE.CORRELATE-000009 §1-§3). `useChartGestures` feeds pointer
 * events through these and applies the result to the store.
 */

import type { Viewport } from "./atoms.js";
import { xToT } from "./timeMapping.js";
import { isClick, panBy, rangeView, wheelFactor, zoomAround } from "./zoom.js";

export interface Drag {
  x0: number;
  x: number;
}

export type Release =
  | { type: "none" }
  | { type: "click"; t: number }
  | { type: "zoom"; view: Viewport };

/** What releasing `drag` at `x` does. */
export function resolveRelease(drag: Drag, x: number, view: Viewport, plotWidth: number): Release {
  if (isClick(drag.x0, x)) return { type: "click", t: xToT(x, view, plotWidth) };
  const next = rangeView(xToT(drag.x0, view, plotWidth), xToT(x, view, plotWidth));
  return next ? { type: "zoom", view: next } : { type: "none" };
}

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
}

/** The view after a wheel event at `x`, or null for a zero delta.
 * Horizontal scroll or Shift+wheel pans; vertical scroll zooms around `x`. */
export function resolveWheel(
  wheel: WheelInput,
  x: number,
  view: Viewport,
  plotWidth: number,
): Viewport | null {
  const panDelta = wheel.shiftKey ? wheel.deltaY || wheel.deltaX : wheel.deltaX;
  if (wheel.shiftKey || Math.abs(wheel.deltaX) > Math.abs(wheel.deltaY)) {
    return panDelta === 0 || plotWidth <= 0 ? null : panBy(view, panDelta / plotWidth);
  }
  if (wheel.deltaY === 0) return null;
  return zoomAround(view, xToT(x, view, plotWidth), wheelFactor(wheel.deltaY));
}

/** The band a drag in progress covers, in px from the plot's left edge. */
export function dragBand(drag: Drag | null): { left: number; width: number } | null {
  if (!drag || isClick(drag.x0, drag.x)) return null;
  return { left: Math.min(drag.x0, drag.x), width: Math.abs(drag.x - drag.x0) };
}
