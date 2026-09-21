import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataStreamIcon, SumpIcon } from "../icons.js";

describe("cor-CORE.UI-000002: icon components", () => {
  it("SumpIcon renders a well-formed SVG with a real viewBox and no hardcoded fill", () => {
    const markup = renderToStaticMarkup(createElement(SumpIcon, { size: 20 }));

    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 64 64"');
    expect(markup).toContain('width="20"');
    expect(markup).toContain('height="20"');
    // fill="currentColor" is set on the <svg> root only, via svgProps --
    // no individual <path> should carry its own fill, or it would
    // override the theme-following color.
    expect(markup.match(/fill="/g)?.length).toBe(1);
    expect(markup).toContain('fill="currentColor"');
  });

  it("DataStreamIcon renders a well-formed SVG with a real viewBox and no hardcoded fill", () => {
    const markup = renderToStaticMarkup(createElement(DataStreamIcon, { size: 20 }));

    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 492.711 492.711"');
    expect(markup.match(/fill="/g)?.length).toBe(1);
    expect(markup).toContain('fill="currentColor"');
  });

  it("sets an accessible label only when a title is given, and never combines it with aria-hidden", () => {
    const withTitle = renderToStaticMarkup(createElement(SumpIcon, { title: "Sump" }));
    const withoutTitle = renderToStaticMarkup(createElement(SumpIcon, {}));

    expect(withTitle).toContain('role="img"');
    expect(withTitle).toContain('aria-label="Sump"');
    expect(withTitle).not.toContain("aria-hidden");
    expect(withoutTitle).not.toContain("role=");
    expect(withoutTitle).not.toContain("aria-label=");
    expect(withoutTitle).toContain('aria-hidden="true"');
  });

  it("defaults to a 16px size when none is given", () => {
    const markup = renderToStaticMarkup(createElement(SumpIcon, {}));
    expect(markup).toContain('width="16"');
    expect(markup).toContain('height="16"');
  });
});
