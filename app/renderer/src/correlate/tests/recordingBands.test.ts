import { describe, expect, it } from "vitest";
import { recordingBands, resolveBands } from "../recordingBands.js";

// cor-CORE.CORRELATE-000012 (REQ-000040): which ranges the band shows.

const seg = (n: number, startedAt: string, stoppedAt: string) => ({
  segmentNumber: n,
  startedAt,
  stoppedAt,
});
const ms = (iso: string) => Date.parse(iso);

describe("cor-CORE.CORRELATE-000012: recordingBands", () => {
  const segments = [seg(1, "2026-10-02T10:00:00Z", "2026-10-02T10:05:00Z")];

  it("while recording: the closed segments plus the open one", () => {
    expect(
      recordingBands({
        status: "recording",
        segments,
        activeSegmentStartedAt: "2026-10-02T10:07:00Z",
      }),
    ).toEqual([
      { t0: ms("2026-10-02T10:00:00Z"), t1: ms("2026-10-02T10:05:00Z") },
      { t0: ms("2026-10-02T10:07:00Z"), t1: null },
    ]);
  });

  it("while paused: the closed segments only, so the pause gap stays out", () => {
    expect(
      recordingBands({ status: "paused", segments, activeSegmentStartedAt: null }),
    ).toHaveLength(1);
  });

  it("nothing once stopped, when idle, or without a session (cttc parity)", () => {
    expect(recordingBands({ status: "stopped", segments, activeSegmentStartedAt: null })).toEqual(
      [],
    );
    expect(recordingBands({ status: "idle", segments: [], activeSegmentStartedAt: null })).toEqual(
      [],
    );
    expect(recordingBands(null)).toEqual([]);
  });

  it("skips malformed or empty segments", () => {
    expect(
      recordingBands({
        status: "paused",
        segments: [
          seg(1, "nope", "2026-10-02T10:05:00Z"),
          seg(2, "2026-10-02T10:05:00Z", "2026-10-02T10:05:00Z"),
        ],
        activeSegmentStartedAt: null,
      }),
    ).toEqual([]);
  });

  it("resolveBands closes the open segment at now", () => {
    expect(
      resolveBands(
        [
          { t0: 10, t1: null },
          { t0: 1, t1: 5 },
        ],
        20,
      ),
    ).toEqual([
      { t0: 10, t1: 20 },
      { t0: 1, t1: 5 },
    ]);
    expect(resolveBands([{ t0: 30, t1: null }], 20)).toEqual([]);
  });
});
