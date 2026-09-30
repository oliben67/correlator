import { createStore } from "jotai";
import { Provider } from "jotai/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Correlate } from "../Correlate.js";
import { liveAtom } from "../correlate/atoms.js";

// cor-CORE.CORRELATE-000009 §4: "Resume live" shows only while paused.

function render(live: boolean) {
  const store = createStore();
  store.set(liveAtom, live);
  return renderToStaticMarkup(
    createElement(Provider, { store }, createElement(Correlate, { sumpId: "s1" })),
  );
}

describe("cor-CORE.CORRELATE-000009: Resume live", () => {
  it("is shown while paused", () => {
    expect(render(false)).toContain("Resume live");
  });

  it("is absent while live", () => {
    expect(render(true)).not.toContain("Resume live");
  });
});

describe("cor-CORE.CORRELATE-000010: mode badge", () => {
  it("says Live while following now and Paused otherwise", () => {
    expect(render(true)).toMatch(/data-view-mode="live"[\s\S]*Live</);
    expect(render(false)).toMatch(/data-view-mode="paused"[\s\S]*Paused</);
  });
});
