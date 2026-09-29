import type { RecordingSessionSummary } from "../correlator-api.js";
import { Button } from "./Button.js";

// cor-CORE.ARCHIVE-000003 §2 (BUG-000008, RM-000042): after a crash, boot
// recovery exports the open segment up to the boot time and leaves the
// session paused. This offers the rule's three choices, ported from cttc's
// resume-choice dialog: resume from the interruption point, resume from now,
// or decide later. Because the data up to the boot time is already saved,
// "interruption point" means that boot time: resuming there leaves no gap.

export type ResumeFrom = "interruption" | "now";

/** Where boot recovery stopped saving: the last segment's end, if any. */
export function interruptionPoint(session: RecordingSessionSummary): string | null {
  return session.segments[session.segments.length - 1]?.stoppedAt ?? null;
}

export interface InterruptedSessionNoticeProps {
  session: RecordingSessionSummary;
  onResume: (from: ResumeFrom) => void;
  onDecideLater: () => void;
}

export function InterruptedSessionNotice({
  session,
  onResume,
  onDecideLater,
}: InterruptedSessionNoticeProps) {
  const point = interruptionPoint(session);
  const pointLabel = point ? new Date(point).toLocaleString() : null;
  return (
    <div
      role="alert"
      style={{
        border: "1px solid var(--warning)",
        borderLeftWidth: 4,
        borderRadius: "var(--radius-md)",
        padding: "8px 12px",
        marginBottom: 8,
        background: "var(--surface-2)",
      }}
    >
      <p style={{ margin: "0 0 8px" }}>
        <strong>A recording was interrupted</strong> when correlator last closed, and has been
        paused.{" "}
        {pointLabel ? `Everything up to ${pointLabel} was saved.` : "Nothing had been saved yet."}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="primary" onClick={() => onResume("interruption")} disabled={!point}>
          Resume from the interruption point
        </Button>
        <Button onClick={() => onResume("now")}>Resume from now</Button>
        <Button onClick={onDecideLater}>Decide later</Button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: "0.85em", color: "var(--muted)" }}>
        {point
          ? "From the interruption point there is no gap. From now leaves a gap between the interruption point and now. Decide later keeps it paused; you can still resume or stop it from the toolbar."
          : "Decide later keeps it paused; you can still resume or stop it from the toolbar."}
      </p>
    </div>
  );
}
