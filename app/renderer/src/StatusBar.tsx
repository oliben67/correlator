import { useEffect, useState } from "react";
import { NotificationHistory } from "./components/NotificationHistory.js";
import { RecordingDot } from "./components/RecordingDot.js";
import { SumpStatusPill } from "./components/SumpStatusPill.js";
import type { SumpSummary } from "./correlator-api.d.ts";
import {
  CLEAR_AFTER_MS,
  type NotificationStore,
  notifications,
  useNotifications,
  visibleNotification,
} from "./notifications.js";

export interface StatusBarProps {
  sumps: SumpSummary[];
  primarySump: SumpSummary | null;
  onRefresh: () => void;
  onSelectPrimary: (sumpId: string) => void;
  recordingStatus?: "idle" | "recording" | "paused" | "stopped";
  /** cor-CORE.SHELL-000007: the notification source; the app-wide store
   * unless a test injects its own. */
  notificationStore?: NotificationStore;
  /** cor-CORE.SHELL-000008: how long a notification stays (the
   * `notificationClearSeconds` preference). */
  clearAfterMs?: number;
}

export function StatusBar({
  sumps,
  primarySump,
  onRefresh,
  onSelectPrimary,
  recordingStatus = "idle",
  notificationStore = notifications,
  clearAfterMs = CLEAR_AFTER_MS,
}: StatusBarProps) {
  const list = useNotifications(notificationStore);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [historyOpen, setHistoryOpen] = useState(false);

  // Re-render once when the newest notification's display time runs out,
  // so the message area clears itself.
  useEffect(() => {
    const newest = list[0];
    if (!newest) return;
    const current = Date.now();
    setNowMs(current);
    const remaining = newest.at + clearAfterMs - current;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNowMs(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [list, clearAfterMs]);

  const visible = visibleNotification(list, nowMs, clearAfterMs);

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
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
        <SumpStatusPill
          sumps={sumps}
          primarySump={primarySump}
          onRefresh={onRefresh}
          onSelectPrimary={onSelectPrimary}
        />

        {recordingStatus !== "idle" && (
          <span>
            <RecordingDot status={recordingStatus} />
            Recording: <strong>{recordingStatus.toUpperCase()}</strong>
          </span>
        )}

        {visible && (
          <span
            role="status"
            data-severity={visible.severity}
            title={visible.message}
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              ...(visible.severity === "error"
                ? { background: "var(--critical)", borderRadius: 3, padding: "1px 6px" }
                : {}),
            }}
          >
            {visible.message}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        style={{
          background: "transparent",
          border: "none",
          // BUG-000006: inherit the footer's text color, no new literal
          // (cor-CORE.UI-000001).
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          flexShrink: 0,
        }}
      >
        History{list.length > 0 ? ` (${list.length})` : ""}
      </button>

      <NotificationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        notifications={list}
        onClear={() => notificationStore.clearHistory()}
      />
    </footer>
  );
}
