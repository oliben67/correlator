import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecordingDot } from "../components/RecordingDot.js";

// cor-CORE.CORRELATE-000012 §1: the recording indicator.

const render = (status: "idle" | "recording" | "paused" | "stopped") =>
  renderToStaticMarkup(createElement(RecordingDot, { status }));

describe("cor-CORE.CORRELATE-000012: RecordingDot", () => {
  it("pulses in --critical while recording", () => {
    const markup = render("recording");
    expect(markup).toContain('class="recording-dot"');
    expect(markup).toContain('data-state="recording"');
    expect(markup).toContain("var(--critical)");
  });

  it("is a steady --warning dot while paused", () => {
    const markup = render("paused");
    expect(markup).toContain('data-state="paused"');
    expect(markup).toContain("var(--warning)");
  });

  it("is absent when idle or stopped", () => {
    expect(render("idle")).toBe("");
    expect(render("stopped")).toBe("");
  });

  it("the pulse keyframe exists and applies only while recording", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(__dirname, "..", "tokens.css"), "utf8");
    expect(css).toContain("@keyframes recording-pulse");
    expect(css).toMatch(
      /\.recording-dot\[data-state="recording"\] \{\s*animation: recording-pulse 1\.5s/,
    );
  });
});
