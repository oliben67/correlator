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
    let exportResult: { id: string; filePath: string } | null = null;
    if (params.exportSegmentFn) {
      try {
        exportResult = await params.exportSegmentFn(
          session.sumpId,
          session.activeSegmentStartedAt,
          now,
        );
      } catch {
        // Best effort
      }
    }

    segments.push({
      segmentNumber: segments.length + 1,
      startedAt: session.activeSegmentStartedAt,
      stoppedAt: now,
      recordingId: exportResult?.id,
      filePath: exportResult?.filePath,
    });
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
    let exportResult: { id: string; filePath: string } | null = null;
    if (params.exportSegmentFn) {
      try {
        exportResult = await params.exportSegmentFn(
          session.sumpId,
          session.activeSegmentStartedAt,
          now,
        );
      } catch {
        // Best effort
      }
    }

    segments.push({
      segmentNumber: segments.length + 1,
      startedAt: session.activeSegmentStartedAt,
      stoppedAt: now,
      recordingId: exportResult?.id,
      filePath: exportResult?.filePath,
    });
  }

  session.status = "stopped";
  session.stoppedAt = now;
  session.activeSegmentStartedAt = null;
  session.segmentsJson = JSON.stringify(segments);

  catalog.upsertRecordingSession(session);
  return session;
}

export function getRecordingSession(
  catalog: Catalog,
  id: string,
): RecordingSessionRow | null {
  return catalog.getRecordingSession(id);
}

export function getActiveRecordingSessionForSump(
  catalog: Catalog,
  sumpId: string,
): RecordingSessionRow | null {
  return catalog.getActiveRecordingSessionForSump(sumpId);
}

export function coerceInterruptedSessions(catalog: Catalog): RecordingSessionRow[] {
  return catalog.coerceInterruptedSessions();
}
