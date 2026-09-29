/**
 * cor-CORE.CORRELATE-000007 (RM-000033): the Correlate view's metric area --
 * a container legend over a CPU % strip and a memory % strip, every
 * container overlaid in its stable color, sharing a 0..max(100, peak)
 * range. `useSeriesPalette` is the one place that turns records + the
 * series atoms into colors, order and hidden state, for the strips and for
 * the log panel alike.
 */

import { useAtom } from "jotai/react";
import { useEffect } from "react";
import type { SumpRecord } from "../correlator-api.js";
import { hiddenSeriesAtom, seriesOrderAtom, seriesSlotsAtom } from "./atoms.js";
import { Chart } from "./Chart.js";
import type { ChartSeries } from "./chartDraw.js";
import { assignSlots, colorForSlot } from "./colorSlots.js";
import { Legend, type LegendEntry } from "./Legend.js";
import {
  type MetricField,
  metricContainerIds,
  metricSeries,
  seriesKeyOf,
  seriesLabels,
} from "./recordMapping.js";
import { orderedKeys, reorder } from "./seriesOrder.js";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

export interface SeriesPalette {
  /** Metric containers, in legend order. */
  keys: string[];
  labels: Record<string, string>;
  hidden: ReadonlySet<string>;
  colorOf: (key: string) => string | undefined;
  toggle: (key: string) => void;
  move: (dragged: string, target: string) => void;
}

export function useSeriesPalette(records: SumpRecord[]): SeriesPalette {
  const [slots, setSlots] = useAtom(seriesSlotsAtom);
  const [order, setOrder] = useAtom(seriesOrderAtom);
  const [hiddenList, setHidden] = useAtom(hiddenSeriesAtom);

  const allKeys = records.map(seriesKeyOf).filter((k): k is string => k !== undefined);
  // Derived during render (so every render, static ones included, sees
  // the colors), then persisted so a slot is never reassigned.
  const effectiveSlots = assignSlots(slots, allKeys);
  useEffect(() => {
    if (effectiveSlots !== slots) setSlots(effectiveSlots);
  }, [effectiveSlots, slots, setSlots]);

  const keys = orderedKeys(order, metricContainerIds(records));
  const hidden = new Set(hiddenList);
  const dark = prefersDark();

  return {
    keys,
    labels: seriesLabels(records),
    hidden,
    colorOf: (key) => {
      const slot = effectiveSlots[key];
      return slot === undefined ? undefined : colorForSlot(slot, dark);
    },
    toggle: (key) =>
      setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
    move: (dragged, target) => setOrder(reorder(keys, dragged, target)),
  };
}

const STRIPS: { field: MetricField; label: string }[] = [
  { field: "cpu_pct", label: "CPU %" },
  { field: "mem_pct", label: "Memory %" },
];

export interface SeriesChartsProps {
  records: SumpRecord[];
}

export function SeriesCharts({ records }: SeriesChartsProps) {
  const palette = useSeriesPalette(records);
  const visibleKeys = palette.keys.filter((k) => !palette.hidden.has(k));

  const entries: LegendEntry[] = palette.keys.map((key) => ({
    key,
    label: palette.labels[key] ?? key,
    color: palette.colorOf(key) ?? "var(--muted)",
    hidden: palette.hidden.has(key),
  }));

  const strips = STRIPS.map(({ field, label }) => {
    const series: ChartSeries[] = metricSeries(records, field, visibleKeys)
      .filter((s) => s.points.length > 0)
      .map((s) => ({ points: s.points, color: palette.colorOf(s.key) }));
    const peak = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.v)));
    return { field, label, series, maxValue: Math.max(100, peak) };
  });

  return (
    <div>
      <Legend entries={entries} onToggle={palette.toggle} onReorder={palette.move} />
      {strips.map((strip) => (
        <div key={strip.field} data-strip={strip.field} data-series-count={strip.series.length}>
          <div style={{ fontSize: "0.8em", color: "var(--muted)" }}>{strip.label}</div>
          <Chart series={strip.series} minValue={0} maxValue={strip.maxValue} label={strip.label} />
        </div>
      ))}
    </div>
  );
}
