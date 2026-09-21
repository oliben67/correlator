import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SumpStatusPill } from "../components/SumpStatusPill.js";
import type { SumpSummary } from "../correlator-api.js";

function sump(overrides: Partial<SumpSummary> = {}): SumpSummary {
  return {
    id: "sump-1",
    name: "local",
    connectionType: "local",
    status: "active",
    ...overrides,
  } as SumpSummary;
}

describe("cor-CORE.UI-000005: SumpStatusPill", () => {
  it("shows 'None connected' with a muted dot when there is no primary Sump", () => {
    const markup = renderToStaticMarkup(
      createElement(SumpStatusPill, {
        sumps: [],
        primarySump: null,
        onRefresh: () => {},
        onSelectPrimary: () => {},
      }),
    );
    expect(markup).toContain("None connected");
    expect(markup).toContain("var(--muted)");
    expect(markup).toContain("No Sumps yet");
  });

  it("shows the primary Sump's name with a green dot when active", () => {
    const markup = renderToStaticMarkup(
      createElement(SumpStatusPill, {
        sumps: [sump()],
        primarySump: sump(),
        onRefresh: () => {},
        onSelectPrimary: () => {},
      }),
    );
    expect(markup).toContain("Sump: local");
    expect(markup).toContain("#2ecc71");
  });

  it("shows a critical-token dot when the primary Sump is not active", () => {
    const markup = renderToStaticMarkup(
      createElement(SumpStatusPill, {
        sumps: [sump({ status: "error" as SumpSummary["status"] })],
        primarySump: sump({ status: "error" as SumpSummary["status"] }),
        onRefresh: () => {},
        onSelectPrimary: () => {},
      }),
    );
    expect(markup).toContain("var(--critical)");
  });

  it("lists every known Sump in the dropdown, marking the primary one", () => {
    const sumps = [sump({ id: "a", name: "Alpha" }), sump({ id: "b", name: "Beta" })];
    const markup = renderToStaticMarkup(
      createElement(SumpStatusPill, {
        sumps,
        primarySump: sumps[0],
        onRefresh: () => {},
        onSelectPrimary: () => {},
      }),
    );
    expect(markup).toContain("Alpha");
    expect(markup).toContain("Beta");
    expect(markup).toContain("Alpha (primary)");
  });
});
