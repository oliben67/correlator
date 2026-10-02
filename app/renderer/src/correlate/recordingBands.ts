/**
 * cor-CORE.CORRELATE-000012 §2: the ranges a recording session has captured,
 * for the chart band. Only while recording or paused (cttc clears the band
 * on Stop); pause gaps stay out. The open segment's end is null -- the
 * chart resolves it to now on each tick.
 */

import type { RecordingSessionSummary } from "../correlator-api.js";

export interface RecordingBand {
  t0: number;
  /** null = the open segment, up to now. */
  t1: number | null;
}

export function recordingBands(
  session: Pick<RecordingSessionSummary, "status" | "segments" | "activeSegmentStartedAt"> | null,
): RecordingBand[] {
  if (!session || (session.status !== "recording" && session.status !== "paused")) return [];
  const bands: RecordingBand[] = [];
  for (const segment of session.segments) {
    const t0 = Date.parse(segment.startedAt);
    const t1 = segment.stoppedAt ? Date.parse(segment.stoppedAt) : Number.NaN;
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) bands.push({ t0, t1 });
  }
  if (session.status === "recording" && session.activeSegmentStartedAt) {
    const t0 = Date.parse(session.activeSegmentStartedAt);
    if (Number.isFinite(t0)) bands.push({ t0, t1: null });
  }
  return bands;
}

/** Bands with the open segment closed at `nowMs`. */
export function resolveBands(
  bands: readonly RecordingBand[],
  nowMs: number,
): { t0: number; t1: number }[] {
  return bands.map((b) => ({ t0: b.t0, t1: b.t1 ?? nowMs })).filter((b) => b.t1 > b.t0);
}
