/**
 * The one shared viewport/cursor state every chart, lane, and log panel
 * reads (cor-CORE.CORRELATE-001) -- never per-component local state.
 */

import { atom } from "jotai";

export interface Viewport {
  t0: number;
  t1: number;
}

export const viewAtom = atom<Viewport>({ t0: 0, t1: 60_000 });

export const cursorTAtom = atom<number | null>(null);

/** ± tolerance (ms) for "this row is highlighted by the current cursor". */
export const windowMsAtom = atom<number>(5000);

/** cor-CORE.CORRELATE-000007: container series state, shared by the legend,
 * the strips and the log panel (and synced across windows). Session-only. */
export const hiddenSeriesAtom = atom<string[]>([]);
export const seriesOrderAtom = atom<string[]>([]);
/** Color slot per series key, assigned once and never reassigned. */
export const seriesSlotsAtom = atom<Readonly<Record<string, number>>>({});
