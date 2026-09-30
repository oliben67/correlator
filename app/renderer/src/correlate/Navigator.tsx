/**
 * The timeline navigator (cor-CORE.CORRELATE-000011 §5): a 14px track under
 * the charts with a thumb for the view. Clicking the track centers the view
 * there and dragging the thumb pans it (both through `zoomTo`, so live
 * follow pauses). The arrow keys pan by a tenth of the view. While
 * paused, a "now" button resumes live.
 */

import { useAtomValue, useStore } from "jotai/react";
import { useEffect, useRef, useState } from "react";
import { liveAtom, nowAtom, type Viewport, viewAtom } from "./atoms.js";
import { PLOT_MARGIN_LEFT } from "./axes.js";
import { resumeLive, zoomTo } from "./correlate.js";
import { centerAtFraction, dragThumb, navExtent, thumbLayout } from "./navLayout.js";
import { panBy } from "./zoom.js";

const TRACK_HEIGHT = 14;

interface ThumbDrag {
  clientX0: number;
  width: number;
  start: Viewport;
  extent: Viewport;
}

export function Navigator() {
  const store = useStore();
  const view = useAtomValue(viewAtom);
  const live = useAtomValue(liveAtom);
  const now = useAtomValue(nowAtom);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<ThumbDrag | null>(null);
  // The extent is frozen during a drag, so the thumb follows the pointer.
  const extent = drag?.extent ?? navExtent(view, now ?? view.t1);
  const thumb = thumbLayout(view, extent);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: MouseEvent) => {
      const fraction = (event.clientX - drag.clientX0) / drag.width;
      zoomTo(store, dragThumb(drag.start, drag.extent, fraction));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, store]);

  // A press on the thumb drags it; anywhere else on the track centers there.
  const onTrackDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (event.button !== 0 || !track) return;
    const rect = track.getBoundingClientRect();
    const width = rect.width || 1;
    const fraction = (event.clientX - rect.left) / width;
    if (fraction >= thumb.left && fraction <= thumb.left + thumb.width) {
      setDrag({ clientX0: event.clientX, width, start: view, extent });
    } else {
      zoomTo(store, centerAtFraction(view, extent, fraction));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowLeft" ? -0.1 : event.key === "ArrowRight" ? 0.1 : 0;
    if (step === 0) return;
    event.preventDefault();
    zoomTo(store, panBy(view, step));
  };

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}
      data-navigator=""
    >
      <div style={{ width: PLOT_MARGIN_LEFT - 6, flexShrink: 0 }} />
      <div
        ref={trackRef}
        role="scrollbar"
        aria-label="Timeline navigator"
        aria-orientation="horizontal"
        aria-controls="correlate-charts"
        aria-valuenow={Math.round(thumb.left * 100)}
        tabIndex={0}
        onMouseDown={onTrackDown}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          flex: 1,
          height: TRACK_HEIGHT,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
        }}
      >
        <div
          data-nav-thumb=""
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${thumb.left * 100}%`,
            width: `${Math.max(thumb.width * 100, 0.5)}%`,
            background: "var(--accent)",
            opacity: 0.5,
            borderRadius: "var(--radius-sm)",
            cursor: "grab",
          }}
        />
      </div>
      {!live && (
        <button type="button" title="Resume live" onClick={() => resumeLive(store)}>
          now
        </button>
      )}
    </div>
  );
}
