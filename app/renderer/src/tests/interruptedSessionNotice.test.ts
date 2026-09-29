import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  InterruptedSessionNotice,
  interruptionPoint,
} from "../components/InterruptedSessionNotice.js";
import type { RecordingSessionSummary } from "../correlator-api.js";

// BUG-000008 / cor-CORE.ARCHIVE-000003 §2: the three-way resume choice.

function session(segments: RecordingSessionSummary["segments"]): RecordingSessionSummary {
  return {
    id: "sess",
    sumpId: "sump-1",
    status: "paused",
    startedAt: "2026-09-29T10:00:00Z",
    stoppedAt: null,
    activeSegmentStartedAt: null,
    segments,
    wasInterrupted: true,
    createdAt: "2026-09-29T10:00:00Z",
  };
}

const saved = session([
  { segmentNumber: 1, startedAt: "2026-09-29T10:00:00Z", stoppedAt: "2026-09-29T10:30:00Z" },
]);

const render = (s: RecordingSessionSummary) =>
  renderToStaticMarkup(
    createElement(InterruptedSessionNotice, {
      session: s,
      onResume: () => {},
      onDecideLater: () => {},
    }),
  );

describe("BUG-000008: InterruptedSessionNotice", () => {
  it("the interruption point is where the last segment stopped", () => {
    expect(interruptionPoint(saved)).toBe("2026-09-29T10:30:00Z");
    expect(interruptionPoint(session([]))).toBeNull();
  });

  it("offers the rule's three choices", () => {
    const markup = render(saved);
    expect(markup).toContain('role="alert"');
    expect(markup).toMatch(
      /<button(?![^>]*disabled)[^>]*>Resume from the interruption point<\/button>/,
    );
    expect(markup).toContain(">Resume from now</button>");
    expect(markup).toContain(">Decide later</button>");
    expect(markup).toContain("Everything up to");
    expect(markup).not.toContain("Dismiss");
  });

  it("can't resume from an interruption point that was never saved", () => {
    const markup = render(session([]));
    expect(markup).toMatch(
      /<button[^>]*disabled[^>]*>Resume from the interruption point<\/button>/,
    );
    expect(markup).toContain("Nothing had been saved yet.");
  });
});
