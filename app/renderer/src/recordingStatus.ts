import type { RecordingSessionSummary } from "./correlator-api.js";

export type RecordingStatus = RecordingSessionSummary["status"];

/** What Correlate reports upward: the status of the recording session it
 * currently holds, tagged with the Sump that session belongs to. */
export interface RecordingStatusReport {
  sumpId: string;
  status: RecordingStatus;
}

/** cor-CORE.SHELL-000004 §2 (BUG-000005): the recording state the status
 * bar shows. Only a report for the active Sump counts -- after a Sump
 * switch the last report may still describe the previous one. */
export function statusBarRecordingStatus(
  report: RecordingStatusReport | null,
  activeSumpId: string | null,
): RecordingStatus {
  if (report === null || activeSumpId === null || report.sumpId !== activeSumpId) {
    return "idle";
  }
  return report.status;
}
