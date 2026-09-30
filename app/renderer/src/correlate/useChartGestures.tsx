/**
 * One gesture handler for every chart strip and event lane
 * (cor-CORE.CORRELATE-000009): click -> setCursor, drag -> zoom band,
 * Esc cancels a drag, double-click -> recenterOn, wheel -> zoom or pan.
 * The decisions are the pure functions in `gestures.ts`; this hook only
 * wires DOM events to them and applies the result to the store.
 */

import { useStore } from "jotai/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { viewAtom } from "./atoms.js";
import { PLOT_MARGIN_LEFT } from "./axes.js";
import { recenterOn, setCursor, zoomTo } from "./correlate.js";
import { type Drag, dragBand, resolveRelease, resolveWheel } from "./gestures.js";
import { xToT } from "./timeMapping.js";

/** The pointer's x within the plot area, right of the shared gutter
 * (cor-CORE.CORRELATE-000010), and that area's width. */
function localX(canvas: HTMLCanvasElement, clientX: number): { x: number; width: number } {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width - PLOT_MARGIN_LEFT);
  return { x: Math.min(width, Math.max(0, clientX - rect.left - PLOT_MARGIN_LEFT)), width };
}

export interface ChartGestures {
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  /** The drag band overlay, or null when no drag is in progress. */
  band: React.ReactNode;
}

export function useChartGestures(canvasRef: RefObject<HTMLCanvasElement | null>): ChartGestures {
  const store = useStore();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  // A drag tracks the pointer on the window, so it keeps working outside
  // the canvas, and ends on release or Esc.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = (next: Drag | null) => {
      dragRef.current = next;
      setDrag(next);
    };
    const onMove = (event: MouseEvent) => {
      const current = dragRef.current;
      if (current) update({ ...current, x: localX(canvas, event.clientX).x });
    };
    const onUp = (event: MouseEvent) => {
      const current = dragRef.current;
      update(null);
      if (!current) return;
      const { x, width } = localX(canvas, event.clientX);
      const release = resolveRelease(current, x, store.get(viewAtom), width);
      if (release.type === "click") setCursor(store, release.t);
      else if (release.type === "zoom") zoomTo(store, release.view);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") update(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragging, canvasRef, store]);

  // React's onWheel is passive, so it can't stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { x, width } = localX(canvas, event.clientX);
      const next = resolveWheel(event, x, store.get(viewAtom), width);
      if (next) zoomTo(store, next);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, store]);

  const onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const { x } = localX(event.currentTarget, event.clientX);
    dragRef.current = { x0: x, x };
    setDrag({ x0: x, x });
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, width } = localX(event.currentTarget, event.clientX);
    recenterOn(store, xToT(x, store.get(viewAtom), width));
  };

  const rect = dragBand(drag);
  const band = rect && (
    <div
      data-drag-band=""
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: PLOT_MARGIN_LEFT + rect.left,
        width: rect.width,
        background: "var(--accent)",
        opacity: 0.15,
        pointerEvents: "none",
      }}
    />
  );
  return { onMouseDown, onDoubleClick, band };
}
