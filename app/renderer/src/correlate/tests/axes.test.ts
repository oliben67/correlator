import { describe, expect, it } from "vitest";
import { formatTick, formatValue, tickStep, timeTicks } from "../axes.js";

// cor-CORE.CORRELATE-000010 (REQ-000037): time ticks and labels.

describe("cor-CORE.CORRELATE-000010: time ticks", () => {
  it("keeps ticks at least 110px apart, on a round step", () => {
    // 15 min over 550px: at most 5 ticks -> 5-minute steps.
    const view = { t0: 0, t1: 15 * 60_000 };
    expect(tickStep(view, 550)).toBe(5 * 60_000);
    expect(timeTicks(view, 550)).toEqual([0, 300_000, 600_000, 900_000]);
  });

  it("places ticks on multiples of the step inside the view", () => {
    const ticks = timeTicks({ t0: 1_234, t1: 11_234 }, 1100); // 10 s, up to 10 ticks
    expect(ticks).toEqual([2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 11_000]);
  });

  it("uses sub-second steps for short spans and caps at seven days", () => {
    expect(tickStep({ t0: 0, t1: 500 }, 1100)).toBe(50);
    expect(tickStep({ t0: 0, t1: 365 * 86_400_000 }, 220)).toBe(7 * 86_400_000);
  });

  it("gives a narrow plot at least one tick's worth of step", () => {
    expect(tickStep({ t0: 0, t1: 60_000 }, 50)).toBe(60_000);
  });
});

describe("cor-CORE.CORRELATE-000010: labels", () => {
  const t = new Date(2026, 8, 30, 7, 5, 3, 42).getTime();

  it("formats local HH:MM:SS, with ms below one-second steps and a date from one day", () => {
    expect(formatTick(t, 5_000)).toBe("07:05:03");
    expect(formatTick(t, 100)).toBe("07:05:03.042");
    expect(formatTick(t, 86_400_000)).toBe("09-30 07:05");
  });

  it("formats values with the unit", () => {
    expect(formatValue(100, "%")).toBe("100%");
    expect(formatValue(2.5)).toBe("2.5");
    expect(formatValue(62.5, "%")).toBe("63%");
  });
});
