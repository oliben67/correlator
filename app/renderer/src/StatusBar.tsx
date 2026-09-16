import type { SumpSummary } from "./correlator-api.d.ts";

export interface StatusBarProps {
  primarySump: SumpSummary | null;
  recordingStatus?: "idle" | "recording" | "paused" | "stopped";
}

export function StatusBar({ primarySump, recordingStatus = "idle" }: StatusBarProps) {
  const isConnected = primarySump?.status === "active";
  const statusColor = isConnected ? "#28a745" : primarySump ? "#dc3545" : "#6c757d";

  return (
    <footer
      style={{
        height: "28px",
        background: "#007acc",
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
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: statusColor,
            }}
          />
          Sump: {primarySump ? primarySump.name : "None connected"}
        </span>

        {recordingStatus !== "idle" && (
          <span>
            Recording: <strong>{recordingStatus.toUpperCase()}</strong>
          </span>
        )}
      </div>

      <div>
        <span>Catalyst v0.27.0</span>
      </div>
    </footer>
  );
}
