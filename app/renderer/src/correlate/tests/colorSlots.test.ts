import { describe, expect, it } from "vitest";
import { assignSlots, colorForSlot, resolveColor } from "../colorSlots.js";
import { orderedKeys, reorder } from "../seriesOrder.js";

// cor-CORE.CORRELATE-000007 (REQ-000034): palette slots + legend order.

describe("cor-CORE.CORRELATE-000007: color slots", () => {
  it("seeds new keys in sorted order and never reassigns a slot", () => {
    const first = assignSlots({}, ["web", "db", "api"]);
    expect(first).toEqual({ api: 0, db: 1, web: 2 });
    const second = assignSlots(first, ["web", "cache", "api"]);
    expect(second).toEqual({ api: 0, db: 1, web: 2, cache: 3 });
    expect(assignSlots(second, ["api"])).toBe(second); // unchanged map when nothing is new
  });

  it("uses the 8 curated tokens, then generated golden-angle hues", () => {
    expect(colorForSlot(0, false)).toBe("var(--series-1)");
    expect(colorForSlot(7, true)).toBe("var(--series-8)");
    expect(colorForSlot(8, false)).toBe("hsl(20.1, 68%, 42%)");
    expect(colorForSlot(8, true)).toBe("hsl(20.1, 68%, 62%)");
    expect(colorForSlot(9, false)).not.toBe(colorForSlot(8, false));
  });

  it("resolves token colors for the canvas and passes other colors through", () => {
    const read = (name: string) => ({ "--series-1": " #2a78d6 " })[name] ?? "";
    expect(resolveColor("var(--series-1)", read)).toBe("#2a78d6");
    expect(resolveColor("var(--missing)", read)).toBe("var(--missing)");
    expect(resolveColor("hsl(1, 2%, 3%)", read)).toBe("hsl(1, 2%, 3%)");
  });
});

describe("cor-CORE.CORRELATE-000007: legend order", () => {
  it("keeps the known order and appends new keys sorted", () => {
    expect(orderedKeys(["web", "api"], ["api", "db", "web", "cache"])).toEqual([
      "web",
      "api",
      "cache",
      "db",
    ]);
    expect(orderedKeys(["gone", "api"], ["api"])).toEqual(["api"]);
  });

  it("moves the dragged key before the target", () => {
    expect(reorder(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(reorder(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
    expect(reorder(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});
