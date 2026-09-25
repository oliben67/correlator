import { describe, expect, it } from "vitest";
import {
  buildDetachSearch,
  DetachRegistry,
  detachWindowSpec,
  parseDetachSearch,
} from "../detach.ts";

describe("detachWindowSpec", () => {
  it("sets alwaysOnTop only for the sidebar kind", () => {
    expect(detachWindowSpec("sidebar").alwaysOnTop).toBe(true);
    expect(detachWindowSpec("chart").alwaysOnTop).toBe(false);
    expect(detachWindowSpec("log").alwaysOnTop).toBe(false);
  });

  it("gives chart the largest footprint and log the smallest", () => {
    const chart = detachWindowSpec("chart");
    const log = detachWindowSpec("log");
    expect(chart.width).toBeGreaterThan(log.width);
  });
});

describe("buildDetachSearch / parseDetachSearch", () => {
  it("round-trips kind, sumpId, view window, and cursor", () => {
    const search = buildDetachSearch("chart", {
      sumpId: "sump-1",
      t0: 1000,
      t1: 61000,
      cursorT: 30000,
    });
    const parsed = parseDetachSearch(search);
    expect(parsed).toEqual({
      kind: "chart",
      state: { sumpId: "sump-1", t0: 1000, t1: 61000, cursorT: 30000 },
    });
  });

  it("omits cursorT from the query string when null", () => {
    const search = buildDetachSearch("log", { sumpId: "sump-1", t0: 0, t1: 1000, cursorT: null });
    expect(search).not.toContain("cursorT");
  });

  it("returns kind: null for a search string with no detach param", () => {
    expect(parseDetachSearch("?foo=bar").kind).toBeNull();
  });

  it("returns kind: null for an unrecognized detach value", () => {
    expect(parseDetachSearch("?detach=bogus").kind).toBeNull();
  });

  it("leaves state fields undefined when absent from the search string", () => {
    const parsed = parseDetachSearch("?detach=sidebar");
    expect(parsed).toEqual({
      kind: "sidebar",
      state: { sumpId: undefined, t0: undefined, t1: undefined, cursorT: undefined },
    });
  });
});

describe("DetachRegistry", () => {
  it("tracks at most one window per kind", () => {
    const registry = new DetachRegistry<{ id: number }>();
    expect(registry.isOpen("chart")).toBe(false);

    registry.set("chart", { id: 1 });
    expect(registry.isOpen("chart")).toBe(true);
    expect(registry.get("chart")).toEqual({ id: 1 });
    expect(registry.isOpen("log")).toBe(false);

    registry.delete("chart");
    expect(registry.isOpen("chart")).toBe(false);
    expect(registry.get("chart")).toBeUndefined();
  });
});
