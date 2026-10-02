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

/** cor-CORE.CORRELATE-000009: the Correlate view follows now (true) until a
 * zoom, pan or recenter pauses it. Shared across windows. */
export const liveAtom = atom(true);

/** cor-CORE.CORRELATE-000011: "now", advanced every second by a live view's
 * tick (`useNowTick`); null where no live view is mounted. */
export const nowAtom = atom<number | null>(null);

/** When a recenter that paused live follow resumes it; null = none pending. */
export const resumeAtAtom = atom<number | null>(null);

export type NowLineStyle = "dotted" | "dashed" | "solid";

/** The live-mark preferences (cor-CORE.SHELL-000008), applied by usePreferences. */
export interface LiveOptions {
  nowLineStyle: NowLineStyle;
  liveTrackEnabled: boolean;
  liveTrackOffsetMs: number;
  /** 0 = a recenter never resumes live. */
  recenterResumeMs: number;
}

/** cor-CORE.CORRELATE-000012: the Correlate view's captured ranges while its
 * session records or is paused; `t1: null` is the open segment (up to now). */
export const recordingBandsAtom = atom<{ t0: number; t1: number | null }[]>([]);
export const sprocketHolesAtom = atom(true);

export const liveOptionsAtom = atom<LiveOptions>({
  nowLineStyle: "dotted",
  liveTrackEnabled: true,
  liveTrackOffsetMs: 0,
  recenterResumeMs: 10_000,
});

/** ± tolerance (ms) for "this row is highlighted by the current cursor". */
export const windowMsAtom = atom<number>(5000);

/** cor-CORE.CORRELATE-000007: container series state, shared by the legend,
 * the strips and the log panel (and synced across windows). Session-only. */
export const hiddenSeriesAtom = atom<string[]>([]);
export const seriesOrderAtom = atom<string[]>([]);
/** Color slot per series key, assigned once and never reassigned. */
export const seriesSlotsAtom = atom<Readonly<Record<string, number>>>({});

/** cor-CORE.CORRELATE-000008: the host telemetry group is collapsed. Session-only. */
export const hostGroupCollapsedAtom = atom(false);
