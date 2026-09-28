import { useSyncExternalStore } from "react";

// cor-CORE.SHELL-000007 (REQ-000029, RM-000031): one renderer-side funnel
// for transient status -- action results and failures -- shown in the
// status bar's message area and kept in an in-memory History. Ported from
// cttc's notifyEvent + status-bar-history-popup. Framework-free so it is
// testable without a DOM; React binds to it via useNotifications().

export type NotificationSeverity = "info" | "error";

export interface AppNotification {
  id: number;
  message: string;
  severity: NotificationSeverity;
  /** Epoch ms when the notification was raised. */
  at: number;
}

/** History cap -- the oldest entries are dropped beyond it. */
export const HISTORY_LIMIT = 100;

/** How long the status bar shows a notification (fixed until
 * RM-000047's Preferences expansion makes it configurable). */
export const CLEAR_AFTER_MS = 5000;

export interface NotificationStore {
  notify(message: string, severity?: NotificationSeverity): AppNotification;
  clearHistory(): void;
  /** Newest first. Stable reference between changes (useSyncExternalStore). */
  getSnapshot(): readonly AppNotification[];
  subscribe(listener: () => void): () => void;
}

export function createNotificationStore(now: () => number = Date.now): NotificationStore {
  let list: readonly AppNotification[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    notify(message, severity = "info") {
      const entry: AppNotification = { id: nextId++, message, severity, at: now() };
      list = [entry, ...list].slice(0, HISTORY_LIMIT);
      emit();
      return entry;
    },
    clearHistory() {
      if (list.length === 0) return;
      list = [];
      emit();
    },
    getSnapshot: () => list,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The notification the status bar shows at `nowMs`: the newest one, while
 * it is younger than `clearAfterMs`. A newer notification replaces an older
 * one immediately and gets its own full display time. */
export function visibleNotification(
  list: readonly AppNotification[],
  nowMs: number,
  clearAfterMs: number = CLEAR_AFTER_MS,
): AppNotification | null {
  const newest = list[0];
  if (!newest) return null;
  return nowMs - newest.at < clearAfterMs ? newest : null;
}

/** The app-wide store. */
export const notifications = createNotificationStore();

export function notify(message: string, severity: NotificationSeverity = "info"): void {
  notifications.notify(message, severity);
}

export function useNotifications(
  store: NotificationStore = notifications,
): readonly AppNotification[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
