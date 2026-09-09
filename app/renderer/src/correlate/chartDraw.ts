/**
 * Pure metric-strip draw function (cor-CORE.CORRELATE-002) -- a full
 * synchronous repaint given a canvas context, the data, the shared
 * viewport, and the cursor. No `requestAnimationFrame`, no incremental
 * diffing. Reimplements the behavior of cttc's `drawStrip` (`app.js`
 * lines ~580-720): adjacent points connect only when within
 * `gapLimitPx` of each other; an isolated point renders as a dot.
 */

import type { Viewport } from "./atoms.js";
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
}

export interface DrawChartStripOptions {
  view: Viewport;
  points: ChartPoint[];
  cursorT: number | null;
  plotWidth: number;
  height: number;
  gapLimitPx?: number;
  minValue?: number;
  maxValue?: number;
}

const DEFAULT_GAP_LIMIT_PX = 40;
const DOT_RADIUS = 2;

export function drawChartStrip(ctx: CanvasLike, options: DrawChartStripOptions): void {
  const { view, points, cursorT, plotWidth, height, gapLimitPx = DEFAULT_GAP_LIMIT_PX } = options;

  ctx.clearRect(0, 0, plotWidth, height);

  if (points.length > 0) {
    const minValue = options.minValue ?? Math.min(...points.map((p) => p.v));
    const maxValue = options.maxValue ?? Math.max(...points.map((p) => p.v));
    const valueRange = maxValue - minValue || 1;
    const valueToY = (v: number) => height - ((v - minValue) / valueRange) * height;

    const pixelPoints = points.map((p) => ({
      x: tToX(p.t, view, plotWidth),
      y: valueToY(p.v),
    }));

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

  if (cursorT !== null && cursorT >= view.t0 && cursorT <= view.t1) {
    const x = tToX(cursorT, view, plotWidth);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}
