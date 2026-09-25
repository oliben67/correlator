import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Panel } from "../components/Panel.js";

describe("cor-CORE.UI-000003: Panel", () => {
  it("renders its children inside a bordered, token-based box", () => {
    const markup = renderToStaticMarkup(createElement(Panel, {}, "hello"));
    expect(markup).toContain("hello");
    expect(markup).toContain("var(--border-strong)");
    expect(markup).toContain("var(--radius-md)");
  });

  it("lets a caller override/extend the default style", () => {
    const markup = renderToStaticMarkup(createElement(Panel, { style: { marginBottom: 0 } }, "x"));
    expect(markup).toContain("margin-bottom:0");
  });
});

describe("cor-CORE.UI-000003: Button", () => {
  it("defaults to the neutral variant", () => {
    const markup = renderToStaticMarkup(createElement(Button, {}, "Save"));
    expect(markup).toContain("var(--surface-2)");
    expect(markup).toContain("Save");
  });

  it("renders the primary variant with the accent fill and white text", () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: "primary" }, "Connect"));
    expect(markup).toContain("var(--accent)");
    expect(markup).toContain("color:#fff");
  });

  it("renders the danger variant with the critical-token fill", () => {
    const markup = renderToStaticMarkup(createElement(Button, { variant: "danger" }, "Uninstall"));
    expect(markup).toContain("var(--critical)");
  });

  it("dims and disables when disabled is passed", () => {
    const markup = renderToStaticMarkup(createElement(Button, { disabled: true }, "x"));
    expect(markup).toContain("disabled");
    expect(markup).toContain("opacity:0.6");
  });
});

describe("cor-CORE.UI-000004: Dialog", () => {
  // Static-markup only: `renderToStaticMarkup` never runs effects, so
  // this covers the rendered shape (a real <dialog> with the given
  // title/children), not the actual showModal()/close()/Escape
  // interaction -- there is no DOM implementation (jsdom/happy-dom) in
  // this project's test environment to exercise that against. The
  // interactive behavior needs either a real Electron launch check or
  // a future dedicated DOM-testing dependency.
  it("renders a real <dialog> element with the given title and children", () => {
    const markup = renderToStaticMarkup(
      createElement(Dialog, { open: true, onClose: () => {}, title: "Add Sump" }, "body content"),
    );
    expect(markup).toContain("<dialog");
    expect(markup).toContain("Add Sump");
    expect(markup).toContain("body content");
  });
});
