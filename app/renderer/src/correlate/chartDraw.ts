/**
 * Pure metric-strip draw function (cor-CORE.CORRELATE-002) -- a full
 * synchronous repaint given a canvas context, the data, the shared
 * viewport, and the cursor. No `requestAnimationFrame`, no incremental
 * diffing. Reimplements the behavior of cttc's `drawStrip` (`app.js`
 * lines ~580-720): adjacent points connect only when within
 * `gapLimitPx` of each other; an isolated point renders as a dot.
 * cor-CORE.CORRELATE-000010: an optional left gutter with value labels,
 * 50%/100% gridlines, and an optional time axis below the plot.
 */

import type { Viewport } from "./atoms.js";
import { formatTick, formatValue, tickStep, timeTicks } from "./axes.js";
import { tToX } from "./timeMapping.js";

export interface ChartPoint {
  t: number;
  v: number;
}

/** The subset of CanvasRenderingContext2D this module actually calls --
 * lets tests pass a lightweight call-recording double instead of a real
 * (or jsdom-mocked) canvas context. */
export interface CanvasLike {
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  setLineDash(segments: number[]): void;
  strokeStyle?: unknown;
  fillStyle?: unknown;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
}

/** cor-CORE.CORRELATE-000007: one container's line on a strip. */
export interface ChartSeries {
  points: ChartPoint[];
  /** A resolved canvas color; omitted = the context's current style. */
  color?: string;
}

export interface DrawChartStripOptions {
  view: Viewport;
  /** Single-series form (cor-CORE.CORRELATE-000002). Ignored when `series` is given. */
  points?: ChartPoint[];
  /** Several series sharing one value range, each with its own gap logic, so
   * points of different series are never joined (cor-CORE.CORRELATE-000007). */
  series?: ChartSeries[];
  cursorT: number | null;
  /** Full canvas width, gutter included. */
  plotWidth: number;
  /** Full canvas height, time axis included. */
  height: number;
  /** Left gutter for value labels and gridlines (cor-CORE.CORRELATE-000010);
   * default 0 = a bare plot, no gridlines or labels. */
  marginLeft?: number;
  /** Height of the time axis below the plot; default 0 (no axis). */
  axisHeight?: number;
  /** Unit appended to value labels. */
  unit?: string;
  /** Gridline and label colors; omitted = the context's current style. */
  gridColor?: string;
  labelColor?: string;
  gapLimitPx?: number;
  minValue?: number;
  maxValue?: number;
  /** Cursor line color; omitted = the context's current style. */
  cursorColor?: string;
}

const DEFAULT_GAP_LIMIT_PX = 40;
const DOT_RADIUS = 2;

function drawSeries(
  ctx: CanvasLike,
  pixelPoints: { x: number; y: number }[],
  gapLimitPx: number,
): void {
  let pathOpen = false;
  for (let i = 0; i < pixelPoints.length; i++) {
    const point = pixelPoints[i];
    const prev = i > 0 ? pixelPoints[i - 1] : null;
    const next = i < pixelPoints.length - 1 ? pixelPoints[i + 1] : null;
    const closeToPrev = prev !== null && point.x - prev.x <= gapLimitPx;
    const closeToNext = next !== null && next.x - point.x <= gapLimitPx;

    if (closeToPrev) {
      ctx.lineTo(point.x, point.y);
      if (!closeToNext) {
        ctx.stroke();
        pathOpen = false;
      }
    } else {
      if (pathOpen) {
        ctx.stroke();
        pathOpen = false;
      }
      if (closeToNext) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        pathOpen = true;
      } else {
        // Isolated on both sides -- a dot, not a (degenerate) line.
        ctx.beginPath();
        ctx.arc(point.x, point.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (pathOpen) {
    ctx.stroke();
  }
}

const LABEL_FONT = "10px sans-serif";

function drawGridAndLabels(
  ctx: CanvasLike,
  options: DrawChartStripOptions,
  area: { left: number; width: number; height: number },
  minValue: number,
  maxValue: number,
): void {
  const baseStroke = ctx.strokeStyle;
  const baseFill = ctx.fillStyle;
  if (options.gridColor !== undefined) ctx.strokeStyle = options.gridColor;
  ctx.setLineDash([2, 3]);
  for (const y of [0.5, area.height / 2]) {
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (options.labelColor !== undefined) ctx.fillStyle = options.labelColor;
  ctx.font = LABEL_FONT;
  ctx.textAlign = "right";
  const x = area.left - 4;
  const labels: [number, number, CanvasTextBaseline][] = [
    [maxValue, 0, "top"],
    [(minValue + maxValue) / 2, area.height / 2, "middle"],
    [minValue, area.height, "bottom"],
  ];
  for (const [v, y, baseline] of labels) {
    ctx.textBaseline = baseline;
    ctx.fillText(formatValue(v, options.unit), x, y);
  }
  ctx.strokeStyle = baseStroke;
  ctx.fillStyle = baseFill;
}

function drawTimeAxis(
  ctx: CanvasLike,
  options: DrawChartStripOptions,
  area: { left: number; width: number; height: number },
): void {
  const { view } = options;
  const baseStroke = ctx.strokeStyle;
  const baseFill = ctx.fillStyle;
  if (options.gridColor !== undefined) ctx.strokeStyle = options.gridColor;
  if (options.labelColor !== undefined) ctx.fillStyle = options.labelColor;
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = tickStep(view, area.width);
  for (const t of timeTicks(view, area.width)) {
    const x = area.left + tToX(t, view, area.width);
    ctx.beginPath();
    ctx.moveTo(x, area.height);
    ctx.lineTo(x, area.height + 3);
    ctx.stroke();
    ctx.fillText(formatTick(t, step), x, area.height + 3);
  }
  ctx.strokeStyle = baseStroke;
  ctx.fillStyle = baseFill;
}

export function drawChartStrip(ctx: CanvasLike, options: DrawChartStripOptions): void {
  const { view, cursorT, plotWidth, height, gapLimitPx = DEFAULT_GAP_LIMIT_PX } = options;
  const series: ChartSeries[] = options.series ?? [{ points: options.points ?? [] }];
  const left = options.marginLeft ?? 0;
  const axisHeight = options.axisHeight ?? 0;
  const area = { left, width: Math.max(1, plotWidth - left), height: height - axisHeight };
  const xOf = (t: number) => left + tToX(t, view, area.width);

  ctx.clearRect(0, 0, plotWidth, height);

  const values = series.flatMap((s) => s.points.map((p) => p.v));
  if (values.length > 0) {
    const minValue = options.minValue ?? Math.min(...values);
    const maxValue = options.maxValue ?? Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const valueToY = (v: number) => area.height - ((v - minValue) / valueRange) * area.height;

    if (left > 0) drawGridAndLabels(ctx, options, area, minValue, maxValue);

    for (const s of series) {
      if (s.points.length === 0) continue;
      if (s.color !== undefined) {
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
      }
      drawSeries(
        ctx,
        s.points.map((p) => ({ x: xOf(p.t), y: valueToY(p.v) })),
        gapLimitPx,
      );
    }
  }

  if (axisHeight > 0) drawTimeAxis(ctx, options, area);

  if (cursorT !== null && cursorT >= view.t0 && cursorT <= view.t1) {
    if (options.cursorColor !== undefined) ctx.strokeStyle = options.cursorColor;
    const x = xOf(cursorT);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, area.height);
    ctx.stroke();
  }
}
