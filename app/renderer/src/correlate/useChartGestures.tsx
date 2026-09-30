/**
 * One gesture handler for every chart strip and event lane
 * (cor-CORE.CORRELATE-000009): click -> setCursor, drag -> zoom band,
 * Esc cancels a drag, double-click -> recenterOn, wheel -> zoom or pan.
 * Under a `ChartCaptureContext` (cor-CORE.EXPORT-000003), a modifier or
 * armed drag captures a range instead, and right-click opens the chart
 * menu. The decisions are the pure functions in `gestures.ts`; this hook
 * only wires DOM events to them and applies the result.
 */

import { useAtomValue, useStore } from "jotai/react";
import { type RefObject, useContext, useEffect, useRef, useState } from "react";
import { viewAtom } from "./atoms.js";
import { PLOT_MARGIN_LEFT } from "./axes.js";
import { ChartCaptureContext, ChartMenu, captureArmedAtom } from "./chartCapture.js";
import { recenterOn, setCursor, zoomTo } from "./correlate.js";
import { type Drag, dragBand, dragMode, resolveRelease, resolveWheel } from "./gestures.js";
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
  onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Crosshair while capture is armed. */
  cursor: "crosshair" | undefined;
  /** The drag band and the menu, when shown. */
  overlay: React.ReactNode;
}

interface Menu {
  left: number;
  top: number;
  t: number;
}

export function useChartGestures(canvasRef: RefObject<HTMLCanvasElement | null>): ChartGestures {
  const store = useStore();
  const capture = useContext(ChartCaptureContext);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const armed = useAtomValue(captureArmedAtom) && capture !== null;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

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
      if (release.type === "click") return setCursor(store, release.t);
      // A capture drag's release disarms, even one too short to capture.
      if (current.mode === "capture") store.set(captureArmedAtom, false);
      if (release.type === "zoom") zoomTo(store, release.view);
      else if (release.type === "capture") captureRef.current?.onRangeSelect(release.view);
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

  // Esc disarms capture and closes the menu; a press elsewhere closes it.
  const menuOpen = menu !== null;
  useEffect(() => {
    if (!armed && !menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      store.set(captureArmedAtom, false);
      setMenu(null);
    };
    const onPress = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    if (menuOpen) window.addEventListener("mousedown", onPress);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPress);
    };
  }, [armed, menuOpen, store]);

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
    const next: Drag = {
      x0: x,
      x,
      mode: dragMode(event, store.get(captureArmedAtom), capture !== null),
    };
    dragRef.current = next;
    setDrag(next);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, width } = localX(event.currentTarget, event.clientX);
    recenterOn(store, xToT(x, store.get(viewAtom), width));
  };

  const onContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!capture) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const { x, width } = localX(canvas, event.clientX);
    const top = event.clientY - canvas.getBoundingClientRect().top;
    setMenu({ left: PLOT_MARGIN_LEFT + x, top, t: xToT(x, store.get(viewAtom), width) });
  };

  const rect = dragBand(drag);
  const overlay = (
    <>
      {rect && drag && (
        <div
          data-drag-band={drag.mode}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: PLOT_MARGIN_LEFT + rect.left,
            width: rect.width,
            background: drag.mode === "capture" ? "var(--warning)" : "var(--accent)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />
      )}
      {menu && capture && (
        <ChartMenu
          left={menu.left}
          top={menu.top}
          onCaptureRange={() => {
            store.set(captureArmedAtom, true);
            setMenu(null);
          }}
          onSnapshotHere={() => {
            capture.onSnapshotAt(menu.t);
            setMenu(null);
          }}
        />
      )}
    </>
  );
  return {
    onMouseDown,
    onDoubleClick,
    onContextMenu,
    cursor: armed ? "crosshair" : undefined,
    overlay,
  };
}
