import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataStreamPicker } from "../components/DataStreamPicker.js";

describe("cor-CORE.UI-000006: DataStreamPicker", () => {
  // Static-markup only, same limitation as Dialog's own tests: this
  // project's test environment has no DOM implementation, and data
  // fetching happens inside useEffect, which renderToStaticMarkup never
  // runs -- so this only ever observes the pre-fetch initial render
  // (sources === null), never the loaded/toggled states. Those need a
  // real Electron launch check or a future dedicated DOM-testing
  // dependency.
  it("renders the loading state before any data has been fetched", () => {
    const markup = renderToStaticMarkup(createElement(DataStreamPicker, { sumpId: "sump-1" }));
    expect(markup).toContain("Data Streams");
    expect(markup).toContain("Loading data streams");
    expect(markup).toContain("Refresh");
  });
});
