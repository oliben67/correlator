/**
 * Thin React wrapper (cor-CORE.CORRELATE-002) -- owns the canvas ref and
 * HiDPI sizing, calls the pure `drawChartStrip` on relevant state
 * change, and turns a click into a `setCursor` call. All the actual
 * drawing/mapping logic lives in `chartDraw.ts`/`timeMapping.ts`, tested
 * independently of this component.
 */

import { useAtomValue, useStore } from "jotai/react";
import { useEffect, useRef } from "react";
import { cursorTAtom, viewAtom } from "./atoms.js";
import { type ChartPoint, type ChartSeries, drawChartStrip } from "./chartDraw.js";
import { resolveColor } from "./colorSlots.js";
import { setCursor } from "./correlate.js";
import { xToT } from "./timeMapping.js";

export interface ChartProps {
  /** Single-series form. */
  points?: ChartPoint[];
  /** cor-CORE.CORRELATE-000007: several colored series on one strip; colors
   * may be CSS-variable references, resolved for the canvas here. */
  series?: ChartSeries[];
  minValue?: number;
  maxValue?: number;
  height?: number;
  /** Accessible name for the strip. */
  label?: string;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

export function Chart({ points, series, minValue, maxValue, height = 80, label }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useStore();
  const view = useAtomValue(viewAtom);
  const cursorT = useAtomValue(cursorTAtom);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const plotWidth = canvas.clientWidth;
    canvas.width = plotWidth * dpr;
    canvas.height = height * dpr;
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
      height,
      minValue,
      maxValue,
      cursorColor: resolveColor("var(--text-primary)", readCssVar),
    });
  }, [view, points, series, cursorT, height, minValue, maxValue]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setCursor(store, xToT(x, view, rect.width));
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      style={{ width: "100%", height }}
      onClick={handleClick}
    />
  );
}
