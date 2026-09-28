import type { AppNotification } from "../notifications.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";

// cor-CORE.SHELL-000007 (REQ-000029): the status bar's History popup --
// every held notification, newest first, with its local time and a Clear
// action. Presentational: the list and handlers come from StatusBar.

export function formatNotificationTime(at: number): string {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export interface NotificationHistoryProps {
  open: boolean;
  onClose: () => void;
  notifications: readonly AppNotification[];
  onClear: () => void;
}

export function NotificationHistory({
  open,
  onClose,
  notifications,
  onClear,
}: NotificationHistoryProps) {
  return (
    <Dialog open={open} onClose={onClose} title="History">
      {notifications.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No notifications yet</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxHeight: 320,
            overflowY: "auto",
            fontSize: "0.9em",
          }}
        >
          {notifications.map((n) => (
            <li
              key={n.id}
              data-severity={n.severity}
              style={{
                display: "flex",
                gap: 10,
                padding: "3px 0",
                color: n.severity === "error" ? "var(--critical)" : "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {formatNotificationTime(n.at)}
              </span>
              <span>{n.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <Button onClick={onClear} disabled={notifications.length === 0}>
          Clear
        </Button>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
