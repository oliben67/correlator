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
