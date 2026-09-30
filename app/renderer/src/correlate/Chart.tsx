/**
 * Thin React wrapper (cor-CORE.CORRELATE-002) -- owns the canvas ref and
 * HiDPI sizing, calls the pure `drawChartStrip` on relevant state
 * change, and routes pointer gestures through `useChartGestures`
 * (click -> `setCursor`, drag/wheel zoom, cor-CORE.CORRELATE-000009).
 * All the actual drawing/mapping logic lives in `chartDraw.ts`/
 * `timeMapping.ts`/`gestures.ts`, tested independently of this component.
 */

import { useAtomValue } from "jotai/react";
import { useEffect, useRef } from "react";
import { cursorTAtom, viewAtom } from "./atoms.js";
import { PLOT_MARGIN_LEFT, TIME_AXIS_HEIGHT } from "./axes.js";
import { type ChartPoint, type ChartSeries, drawChartStrip } from "./chartDraw.js";
import { resolveColor } from "./colorSlots.js";
import { useChartGestures } from "./useChartGestures.js";

export interface ChartProps {
  /** Single-series form. */
  points?: ChartPoint[];
  /** cor-CORE.CORRELATE-000007: several colored series on one strip; colors
   * may be CSS-variable references, resolved for the canvas here. */
  series?: ChartSeries[];
  minValue?: number;
  maxValue?: number;
  /** Plot height; a time axis adds its own height below. */
  height?: number;
  /** Accessible name for the strip. */
  label?: string;
  /** cor-CORE.CORRELATE-000010: draw a time axis (the group's last strip). */
  timeAxis?: boolean;
  /** Unit for the gutter's value labels. */
  unit?: string;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

export function Chart({
  points,
  series,
  minValue,
  maxValue,
  height = 80,
  label,
  timeAxis = false,
  unit,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useAtomValue(viewAtom);
  const gestures = useChartGestures(canvasRef);
  const cursorT = useAtomValue(cursorTAtom);

  const axisHeight = timeAxis ? TIME_AXIS_HEIGHT : 0;
  const fullHeight = height + axisHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const plotWidth = canvas.clientWidth;
    canvas.width = plotWidth * dpr;
    canvas.height = fullHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChartStrip(ctx, {
      view,
      points,
      series: series?.map((s) => ({
        points: s.points,
        color: s.color === undefined ? undefined : resolveColor(s.color, readCssVar),
      })),
      cursorT,
      plotWidth,
      height: fullHeight,
      marginLeft: PLOT_MARGIN_LEFT,
      axisHeight,
      unit,
      minValue,
      maxValue,
      cursorColor: resolveColor("var(--text-primary)", readCssVar),
      gridColor: resolveColor("var(--grid)", readCssVar),
      labelColor: resolveColor("var(--muted)", readCssVar),
    });
  }, [view, points, series, cursorT, fullHeight, axisHeight, unit, minValue, maxValue]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        data-time-axis={timeAxis ? "" : undefined}
        style={{ width: "100%", height: fullHeight, display: "block" }}
        onMouseDown={gestures.onMouseDown}
        onDoubleClick={gestures.onDoubleClick}
      />
      {gestures.band}
    </div>
  );
}
