import type { RecordingSessionSummary } from "../correlator-api.js";

// cor-CORE.CORRELATE-000012 §1: a pulsing --critical dot while recording,
// a steady --warning dot while paused, nothing otherwise. The pulse is the
// `recording-pulse` keyframe in tokens.css.

export function RecordingDot({ status }: { status: RecordingSessionSummary["status"] }) {
  if (status !== "recording" && status !== "paused") return null;
  return (
    <span
      className="recording-dot"
      data-state={status}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        marginRight: 6,
        verticalAlign: "middle",
        background: status === "recording" ? "var(--critical)" : "var(--warning)",
      }}
    />
  );
}
