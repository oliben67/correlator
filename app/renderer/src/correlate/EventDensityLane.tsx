/**
 * Thin React wrapper (cor-CORE.CORRELATE-003) -- one lane per log
 * source. Fill opacity is bucketed (`densityBuckets.ts`); click
 * resolution is continuous, resolved through the same `xToT` mapping
 * every other component uses, never bucket-snapped. Gestures are the
 * charts' own (`useChartGestures`, cor-CORE.CORRELATE-000009).
 */

import { useAtomValue } from "jotai/react";
import { useEffect, useRef } from "react";
import { viewAtom } from "./atoms.js";
import { bucketize } from "./densityBuckets.js";
import { useChartGestures } from "./useChartGestures.js";

export interface EventDensityLaneProps {
  recordTimestamps: number[];
  height?: number;
}

const LANE_HEIGHT = 8;

export function EventDensityLane({
  recordTimestamps,
  height = LANE_HEIGHT,
}: EventDensityLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useAtomValue(viewAtom);
  const gestures = useChartGestures(canvasRef);

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
    ctx.clearRect(0, 0, plotWidth, height);

    const bucketCount = Math.max(1, Math.round(plotWidth));
    const counts = bucketize(recordTimestamps, view, bucketCount);
    const maxCount = Math.max(1, ...counts);
    const bucketWidth = plotWidth / bucketCount;

    for (let b = 0; b < bucketCount; b++) {
      if (!counts[b]) continue;
      ctx.globalAlpha = 0.35 + 0.65 * (counts[b] / maxCount);
      ctx.fillRect(b * bucketWidth, 1, Math.max(1, bucketWidth - 0.5), height - 2);
    }
    ctx.globalAlpha = 1;
  }, [view, recordTimestamps, height]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height, display: "block" }}
        onMouseDown={gestures.onMouseDown}
        onDoubleClick={gestures.onDoubleClick}
      />
      {gestures.band}
    </div>
  );
}
