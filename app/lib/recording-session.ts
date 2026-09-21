/**
 * Live recording session manager (cor-CORE.ARCHIVE-003).
 */

import { randomUUID } from "node:crypto";
import type { Catalog, RecordingSegment, RecordingSessionRow } from "./catalog.ts";

export type ExportSegmentFn = (
  sumpId: string,
  startIso: string,
  endIso: string,
) => Promise<{ id: string; filePath: string } | null>;

export interface StartRecordingSessionParams {
  id?: string;
  sumpId: string;
  now?: string;
}

export interface PauseRecordingSessionParams {
  sessionId: string;
  exportSegmentFn?: ExportSegmentFn;
  now?: string;
}

export interface ResumeRecordingSessionParams {
  sessionId: string;
  now?: string;
}

export interface StopRecordingSessionParams {
  sessionId: string;
  exportSegmentFn?: ExportSegmentFn;
  now?: string;
}

/** Exports the segment running from `startedAt` to `now` (best effort --
 * a failed export still closes out the segment, just without a
 * `recordingId`/`filePath`) and appends it to `segments`. Shared by
 * pause/stop/boot-crash-recovery, which all close out an open segment
 * the same way. */
async function closeSegment(
  segments: RecordingSegment[],
  sumpId: string,
  startedAt: string,
  now: string,
  exportSegmentFn?: ExportSegmentFn,
): Promise<void> {
  let exportResult: { id: string; filePath: string } | null = null;
  if (exportSegmentFn) {
    try {
      exportResult = await exportSegmentFn(sumpId, startedAt, now);
    } catch {
      // Best effort
    }
  }

  segments.push({
    segmentNumber: segments.length + 1,
    startedAt,
    stoppedAt: now,
    recordingId: exportResult?.id,
    filePath: exportResult?.filePath,
  });
}

export function startRecordingSession(
  catalog: Catalog,
  params: StartRecordingSessionParams,
): RecordingSessionRow {
  const existing = catalog.getActiveRecordingSessionForSump(params.sumpId);
  if (existing) {
    return existing;
  }

  const now = params.now ?? new Date().toISOString();
  const session: RecordingSessionRow = {
    id: params.id ?? `rec_sess_${randomUUID()}`,
    sumpId: params.sumpId,
    status: "recording",
    startedAt: now,
    stoppedAt: null,
    activeSegmentStartedAt: now,
    segmentsJson: "[]",
    wasInterrupted: false,
    createdAt: now,
  };

  catalog.upsertRecordingSession(session);
  return session;
}

export async function pauseRecordingSession(
  catalog: Catalog,
  params: PauseRecordingSessionParams,
): Promise<RecordingSessionRow | null> {
  const session = catalog.getRecordingSession(params.sessionId);
  if (!session || session.status !== "recording") {
    return session;
  }

  const now = params.now ?? new Date().toISOString();
  const segments: RecordingSegment[] = JSON.parse(session.segmentsJson);

  if (session.activeSegmentStartedAt) {
    await closeSegment(
      segments,
      session.sumpId,
      session.activeSegmentStartedAt,
      now,
      params.exportSegmentFn,
    );
  }

  session.status = "paused";
  session.activeSegmentStartedAt = null;
  session.segmentsJson = JSON.stringify(segments);

  catalog.upsertRecordingSession(session);
  return session;
}

export function resumeRecordingSession(
  catalog: Catalog,
  params: ResumeRecordingSessionParams,
): RecordingSessionRow | null {
  const session = catalog.getRecordingSession(params.sessionId);
  if (!session || session.status !== "paused") {
    return session;
  }

  const now = params.now ?? new Date().toISOString();
  session.status = "recording";
  session.activeSegmentStartedAt = now;

  catalog.upsertRecordingSession(session);
  return session;
}

export async function stopRecordingSession(
  catalog: Catalog,
  params: StopRecordingSessionParams,
): Promise<RecordingSessionRow | null> {
  const session = catalog.getRecordingSession(params.sessionId);
  if (!session || session.status === "stopped" || session.status === "idle") {
    return session;
  }

  const now = params.now ?? new Date().toISOString();
  const segments: RecordingSegment[] = JSON.parse(session.segmentsJson);

  if (session.status === "recording" && session.activeSegmentStartedAt) {
    await closeSegment(
      segments,
      session.sumpId,
      session.activeSegmentStartedAt,
      now,
      params.exportSegmentFn,
    );
  }

  session.status = "stopped";
  session.stoppedAt = now;
  session.activeSegmentStartedAt = null;
  session.segmentsJson = JSON.stringify(segments);

  catalog.upsertRecordingSession(session);
  return session;
}

export function getRecordingSession(catalog: Catalog, id: string): RecordingSessionRow | null {
  return catalog.getRecordingSession(id);
}

export function getActiveRecordingSessionForSump(
  catalog: Catalog,
  sumpId: string,
): RecordingSessionRow | null {
  return catalog.getActiveRecordingSessionForSump(sumpId);
}

/**
 * Boot-time crash recovery (cor-CORE.ARCHIVE-000003): a session left in
 * `"recording"` status when the app last exited had its data-collection
 * cut off mid-segment. Closes out that open segment the same way
 * `pauseRecordingSession`/`stopRecordingSession` do -- exporting it via
 * `exportSegmentFn` before marking the session `paused`+`wasInterrupted`
 * -- so a crash never silently drops the telemetry/logs already
 * captured before it happened.
 */
export async function coerceInterruptedSessions(
  catalog: Catalog,
  exportSegmentFn?: ExportSegmentFn,
): Promise<RecordingSessionRow[]> {
  const sessions = catalog.listRecordingSessionsByStatus("recording");
  const coerced: RecordingSessionRow[] = [];
  for (const session of sessions) {
    const now = new Date().toISOString();
    const segments: RecordingSegment[] = JSON.parse(session.segmentsJson);

    if (session.activeSegmentStartedAt) {
      await closeSegment(
        segments,
        session.sumpId,
        session.activeSegmentStartedAt,
        now,
        exportSegmentFn,
      );
    }

    session.status = "paused";
    session.wasInterrupted = true;
    session.activeSegmentStartedAt = null;
    session.segmentsJson = JSON.stringify(segments);

    catalog.upsertRecordingSession(session);
    coerced.push(session);
  }
  return coerced;
}
