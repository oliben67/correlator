import { SumpStatusPill } from "./components/SumpStatusPill.js";
import type { SumpSummary } from "./correlator-api.d.ts";

export interface StatusBarProps {
  sumps: SumpSummary[];
  primarySump: SumpSummary | null;
  onRefresh: () => void;
  onSelectPrimary: (sumpId: string) => void;
  recordingStatus?: "idle" | "recording" | "paused" | "stopped";
}

export function StatusBar({
  sumps,
  primarySump,
  onRefresh,
  onSelectPrimary,
  recordingStatus = "idle",
}: StatusBarProps) {
  return (
    <footer
      style={{
        height: "28px",
        background: "var(--accent)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: "0.85em",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <SumpStatusPill
          sumps={sumps}
          primarySump={primarySump}
          onRefresh={onRefresh}
          onSelectPrimary={onSelectPrimary}
        />

        {recordingStatus !== "idle" && (
          <span>
            Recording: <strong>{recordingStatus.toUpperCase()}</strong>
          </span>
        )}
      </div>
    </footer>
  );
}
