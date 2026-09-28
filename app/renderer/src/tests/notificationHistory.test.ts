import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatNotificationTime, NotificationHistory } from "../components/NotificationHistory.js";
import type { SumpSummary } from "../correlator-api.js";
import { CLEAR_AFTER_MS, createNotificationStore } from "../notifications.js";
import { StatusBar } from "../StatusBar.js";

// cor-CORE.SHELL-000007 (REQ-000029): History popup + status-bar message area.

const sump = {
  id: "sump-1",
  name: "local",
  connectionType: "local",
  status: "active",
} as SumpSummary;

function renderHistory(store = createNotificationStore()) {
  return renderToStaticMarkup(
    createElement(NotificationHistory, {
      open: true,
      onClose: () => {},
      notifications: store.getSnapshot(),
      onClear: () => {},
    }),
  );
}

function renderBar(store = createNotificationStore()) {
  return renderToStaticMarkup(
    createElement(StatusBar, {
      sumps: [sump],
      primarySump: sump,
      onRefresh: () => {},
      onSelectPrimary: () => {},
      notificationStore: store,
    }),
  );
}

describe("cor-CORE.SHELL-000007: NotificationHistory", () => {
  it("says so when there are no notifications, with Clear disabled", () => {
    const markup = renderHistory();
    expect(markup).toContain("No notifications yet");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Clear<\/button>/);
  });

  it("lists notifications newest first with their time, errors marked", () => {
    let t = new Date(2026, 8, 28, 9, 5, 7).getTime();
    const store = createNotificationStore(() => t);
    store.notify("Recording started");
    t += 1000;
    store.notify("Export failed: disk full", "error");
    const markup = renderHistory(store);
    expect(markup.indexOf("Export failed: disk full")).toBeLessThan(
      markup.indexOf("Recording started"),
    );
    expect(markup).toContain("09:05:07");
    expect(markup).toContain("09:05:08");
    expect(markup).toContain('data-severity="error"');
    expect(markup).not.toContain("No notifications yet");
  });

  it("formats times as zero-padded HH:MM:SS", () => {
    expect(formatNotificationTime(new Date(2026, 0, 1, 7, 3, 9).getTime())).toBe("07:03:09");
  });
});

describe("cor-CORE.SHELL-000007: StatusBar message area", () => {
  it("shows the newest fresh notification and the history count", () => {
    const store = createNotificationStore();
    store.notify("Snapshot exported");
    const markup = renderBar(store);
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Snapshot exported");
    expect(markup).toContain("History (1)");
  });

  it("marks an error notification with the critical token", () => {
    const store = createNotificationStore();
    store.notify("Could not start recording", "error");
    const markup = renderBar(store);
    expect(markup).toContain('data-severity="error"');
    expect(markup).toContain("var(--critical)");
  });

  it("shows no message once the newest notification has expired", () => {
    const store = createNotificationStore(() => Date.now() - CLEAR_AFTER_MS - 1);
    store.notify("old news");
    const markup = renderBar(store);
    expect(markup).not.toContain('role="status"');
    // still listed in History
    expect(markup).toContain("History (1)");
  });

  it("shows a plain History button when there is nothing yet", () => {
    const markup = renderBar();
    expect(markup).not.toContain('role="status"');
    expect(markup).toMatch(/>History<\/button>/);
  });
});
