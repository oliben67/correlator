import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SumpSummary } from "../correlator-api.js";
import { statusBarRecordingStatus } from "../recordingStatus.js";
import { StatusBar } from "../StatusBar.js";

// BUG-000005 regression: cor-CORE.SHELL-000004 §2 -- the status bar shows
// the active Sump's recording session state.

const sump = {
  id: "sump-1",
  name: "local",
  connectionType: "local",
  status: "active",
} as SumpSummary;

function renderBar(recordingStatus: ReturnType<typeof statusBarRecordingStatus>): string {
  return renderToStaticMarkup(
    createElement(StatusBar, {
      sumps: [sump],
      primarySump: sump,
      onRefresh: () => {},
      onSelectPrimary: () => {},
      recordingStatus,
    }),
  );
}

describe("BUG-000005: statusBarRecordingStatus", () => {
  it("is idle before Correlate has reported anything", () => {
    expect(statusBarRecordingStatus(null, "sump-1")).toBe("idle");
  });

  it("passes through the active Sump's reported status", () => {
    expect(statusBarRecordingStatus({ sumpId: "sump-1", status: "recording" }, "sump-1")).toBe(
      "recording",
    );
    expect(statusBarRecordingStatus({ sumpId: "sump-1", status: "paused" }, "sump-1")).toBe(
      "paused",
    );
  });

  it("ignores a report for a different Sump (stale after a Sump switch)", () => {
    expect(statusBarRecordingStatus({ sumpId: "sump-1", status: "recording" }, "sump-2")).toBe(
      "idle",
    );
  });

  it("is idle when there is no active Sump", () => {
    expect(statusBarRecordingStatus({ sumpId: "sump-1", status: "recording" }, null)).toBe("idle");
  });
});

describe("BUG-000005: StatusBar recording display", () => {
  it("shows RECORDING while a session records", () => {
    expect(renderBar("recording")).toContain("RECORDING");
  });

  it("shows PAUSED while a session is paused", () => {
    expect(renderBar("paused")).toContain("PAUSED");
  });

  it("shows no recording label when idle", () => {
    expect(renderBar("idle")).not.toContain("Recording:");
  });
});
