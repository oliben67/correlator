/**
 * Pure axis layout (cor-CORE.CORRELATE-000010): the shared left gutter,
 * round-step time ticks, and tick/value label formatting. Tick density is
 * cttc's (one per 110px); snapping to round clock steps is this port's.
 */

import type { Viewport } from "./atoms.js";

/** Left gutter every strip and lane reserves for value labels (px). */
export const PLOT_MARGIN_LEFT = 40;
/** Height of a strip's time axis below its plot (px). */
export const TIME_AXIS_HEIGHT = 16;
const MIN_TICK_SPACING_PX = 110;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STEPS = [
  50,
  100,
  200,
  500,
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
];

/** The smallest round step that keeps ticks at least 110px apart. */
export function tickStep(view: Viewport, plotWidth: number): number {
  const maxTicks = Math.max(1, Math.floor(plotWidth / MIN_TICK_SPACING_PX));
  const span = view.t1 - view.t0;
  return STEPS.find((step) => span / step <= maxTicks) ?? STEPS[STEPS.length - 1];
}

/** Multiples of the step inside the view. */
export function timeTicks(view: Viewport, plotWidth: number): number[] {
  const step = tickStep(view, plotWidth);
  const ticks: number[] = [];
  for (let t = Math.ceil(view.t0 / step) * step; t <= view.t1; t += step) ticks.push(t);
  return ticks;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Local clock label for a tick: `.mmm` below one-second steps, date from one-day steps. */
export function formatTick(t: number, step: number): string {
  const d = new Date(t);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (step >= DAY) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
  const hms = `${hm}:${pad(d.getSeconds())}`;
  return step < SECOND ? `${hms}.${pad(d.getMilliseconds(), 3)}` : hms;
}

/** A gutter value label: integers as-is, otherwise one decimal below 10. */
export function formatValue(v: number, unit = ""): string {
  const text = Number.isInteger(v) ? String(v) : Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0);
  return `${text}${unit}`;
}
