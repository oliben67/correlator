/**
 * Pure time<->pixel mapping (cor-CORE.CORRELATE-001) -- every chart,
 * lane, and log panel uses these same two functions, parameterized by
 * the shared viewport, so a pixel maps to the same timestamp everywhere.
 * Reimplements the behavior of cttc's `xToT`/`tToX` (`app.js` lines
 * ~463-478).
 */

import type { Viewport } from "./atoms.js";

export function xToT(x: number, view: Viewport, plotWidth: number): number {
  const { t0, t1 } = view;
  return t0 + (x / plotWidth) * (t1 - t0);
}

export function tToX(t: number, view: Viewport, plotWidth: number): number {
  const { t0, t1 } = view;
  return ((t - t0) / (t1 - t0)) * plotWidth;
}

/**
 * Is `rowTs` within `windowMs` of `cursorT`? A flat, symmetric tolerance
 * -- never a bucket-snap. `cursorT === null` (no active correlation)
 * always highlights nothing.
 */
export function isHighlighted(rowTs: number, cursorT: number | null, windowMs: number): boolean {
  if (cursorT === null) return false;
  return Math.abs(rowTs - cursorT) <= windowMs;
}
