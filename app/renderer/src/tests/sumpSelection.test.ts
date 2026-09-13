import { describe, expect, it } from "vitest";
import type { SumpSummary } from "../correlator-api.js";
import { isCorrelatable, resolveActiveSump, selectableSumps } from "../sumpSelection.js";

function sump(overrides: Partial<SumpSummary>): SumpSummary {
  return {
    id: "id",
    name: "name",
    connectionType: "local",
    host: null,
    port: null,
    status: "active",
    authToken: null,
    catalogJson: "{}",
    createdAt: "2026-09-12T00:00:00Z",
    lastSeenAt: null,
    parentSumpId: null,
    dockerHost: null,
    ...overrides,
  };
}

describe("selectableSumps", () => {
  it("includes a root with no discovered children", () => {
    const root = sump({ id: "root-1" });
    expect(selectableSumps([root])).toEqual([root]);
  });

  it("excludes a root that has at least one discovered host-scoped child", () => {
    const root = sump({ id: "root-1" });
    const child = sump({ id: "root-1:host-a", parentSumpId: "root-1", dockerHost: "host-a" });
    expect(selectableSumps([root, child])).toEqual([child]);
  });

  it("includes every host-scoped child regardless of its parent's own inclusion", () => {
    const root = sump({ id: "root-1" });
    const childA = sump({ id: "root-1:host-a", parentSumpId: "root-1", dockerHost: "host-a" });
    const childB = sump({ id: "root-1:host-b", parentSumpId: "root-1", dockerHost: "host-b" });
    expect(selectableSumps([root, childA, childB])).toEqual([childA, childB]);
  });
});

describe("resolveActiveSump", () => {
  it("picks the primary when it's among the selectable sumps", () => {
    const a = sump({ id: "a" });
    const b = sump({ id: "b" });
    expect(resolveActiveSump([a, b], "b")).toBe(b);
  });

  it("falls back to the first selectable sump when no primary is set", () => {
    const a = sump({ id: "a" });
    const b = sump({ id: "b" });
    expect(resolveActiveSump([a, b], null)).toBe(a);
  });

  it("falls back to the first selectable sump when the primary is no longer selectable", () => {
    const a = sump({ id: "a" });
    expect(resolveActiveSump([a], "retired-elsewhere")).toBe(a);
  });

  it("returns null when nothing is selectable", () => {
    expect(resolveActiveSump([], null)).toBeNull();
  });
});

// BUG-000003: a childless root is selectable (so the switcher isn't
// blank) but has no docker_host scope -- handing it to <Correlate>
// throws "no docker_host scope" from the real query-records handler.
describe("isCorrelatable", () => {
  it("is false for null", () => {
    expect(isCorrelatable(null)).toBe(false);
  });

  it("is false for a childless root with no docker_host scope", () => {
    expect(isCorrelatable(sump({ id: "root-1", dockerHost: null }))).toBe(false);
  });

  it("is true for a host-scoped sump", () => {
    expect(isCorrelatable(sump({ id: "root-1:host-a", dockerHost: "host-a" }))).toBe(true);
  });
});
