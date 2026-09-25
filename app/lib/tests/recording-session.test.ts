import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Catalog } from "../catalog.ts";
import {
  coerceInterruptedSessions,
  getActiveRecordingSessionForSump,
  pauseRecordingSession,
  resumeRecordingSession,
  startRecordingSession,
  stopRecordingSession,
} from "../recording-session.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-rec-session-test-"));
  dbPath = join(dir, "catalog.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("RecordingSessionManager", () => {
  it("starts a new recording session and sets activeSegmentStartedAt", () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    const session = startRecordingSession(catalog, {
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    expect(session.status).toBe("recording");
    expect(session.startedAt).toBe("2026-09-16T10:00:00Z");
    expect(session.activeSegmentStartedAt).toBe("2026-09-16T10:00:00Z");

    const active = getActiveRecordingSessionForSump(catalog, "sump-1");
    expect(active?.id).toBe(session.id);
    catalog.close();
  });

  it("pauses, resumes, and stops a session exporting segments", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    startRecordingSession(catalog, {
      id: "sess-1",
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    const mockExport = async (_sumpId: string, startIso: string, endIso: string) => {
      return { id: `rec-${startIso}-${endIso}`, filePath: `/path/${startIso}.recording` };
    };

    // Pause session
    const paused = await pauseRecordingSession(catalog, {
      sessionId: "sess-1",
      exportSegmentFn: mockExport,
      now: "2026-09-16T10:05:00Z",
    });
    expect(paused?.status).toBe("paused");
    expect(paused?.activeSegmentStartedAt).toBeNull();
    const segments1 = JSON.parse(paused?.segmentsJson ?? "[]");
    expect(segments1).toHaveLength(1);
    expect(segments1[0].segmentNumber).toBe(1);

    // Resume session
    const resumed = resumeRecordingSession(catalog, {
      sessionId: "sess-1",
      now: "2026-09-16T10:10:00Z",
    });
    expect(resumed?.status).toBe("recording");
    expect(resumed?.activeSegmentStartedAt).toBe("2026-09-16T10:10:00Z");

    // Stop session
    const stopped = await stopRecordingSession(catalog, {
      sessionId: "sess-1",
      exportSegmentFn: mockExport,
      now: "2026-09-16T10:15:00Z",
    });
    expect(stopped?.status).toBe("stopped");
    expect(stopped?.stoppedAt).toBe("2026-09-16T10:15:00Z");
    const segments2 = JSON.parse(stopped?.segmentsJson ?? "[]");
    expect(segments2).toHaveLength(2);
    expect(segments2[1].segmentNumber).toBe(2);

    catalog.close();
  });

  it("handles illegal transitions as no-ops without throwing", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    startRecordingSession(catalog, {
      id: "sess-1",
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    // Resume while already recording
    const res = resumeRecordingSession(catalog, { sessionId: "sess-1" });
    expect(res?.status).toBe("recording");

    await stopRecordingSession(catalog, { sessionId: "sess-1" });

    // Pause while already stopped
    const pauseOnStopped = await pauseRecordingSession(catalog, { sessionId: "sess-1" });
    expect(pauseOnStopped?.status).toBe("stopped");

    catalog.close();
  });

  it("coerces crashed recording sessions to paused state on app boot", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    startRecordingSession(catalog, {
      id: "sess-crashed",
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    // Simulate process restart
    const interrupted = await coerceInterruptedSessions(catalog);
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].id).toBe("sess-crashed");
    expect(interrupted[0].status).toBe("paused");
    expect(interrupted[0].wasInterrupted).toBe(true);

    catalog.close();
  });

  it("exports the crashed session's open segment instead of silently dropping it", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    startRecordingSession(catalog, {
      id: "sess-crashed",
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    const mockExport = async (_sumpId: string, startIso: string, endIso: string) => {
      return { id: `rec-${startIso}-${endIso}`, filePath: `/path/${startIso}.recording` };
    };

    const interrupted = await coerceInterruptedSessions(catalog, mockExport);

    expect(interrupted).toHaveLength(1);
    const segments = JSON.parse(interrupted[0].segmentsJson);
    expect(segments).toHaveLength(1);
    expect(segments[0].startedAt).toBe("2026-09-16T10:00:00Z");
    expect(segments[0].recordingId).toBe(`rec-2026-09-16T10:00:00Z-${segments[0].stoppedAt}`);
    expect(segments[0].filePath).toBe("/path/2026-09-16T10:00:00Z.recording");

    catalog.close();
  });

  it("still marks the session paused/interrupted even when the export itself fails", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "localhost",
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-16T10:00:00Z",
      lastSeenAt: null,
    });

    startRecordingSession(catalog, {
      id: "sess-crashed",
      sumpId: "sump-1",
      now: "2026-09-16T10:00:00Z",
    });

    const failingExport = async () => {
      throw new Error("sump unreachable");
    };

    const interrupted = await coerceInterruptedSessions(catalog, failingExport);

    expect(interrupted[0].status).toBe("paused");
    expect(interrupted[0].wasInterrupted).toBe(true);
    const segments = JSON.parse(interrupted[0].segmentsJson);
    expect(segments).toHaveLength(1);
    expect(segments[0].recordingId).toBeUndefined();
    expect(segments[0].filePath).toBeUndefined();

    catalog.close();
  });
});
