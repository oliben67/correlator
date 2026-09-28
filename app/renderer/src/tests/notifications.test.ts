import { describe, expect, it } from "vitest";
import {
  type AppNotification,
  CLEAR_AFTER_MS,
  createNotificationStore,
  HISTORY_LIMIT,
  visibleNotification,
} from "../notifications.js";

// cor-CORE.SHELL-000007 (REQ-000029): notification store + visibility.

function clock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("cor-CORE.SHELL-000007: notification store", () => {
  it("records a notification with its severity and time, newest first", () => {
    const c = clock();
    const store = createNotificationStore(c.now);
    store.notify("first");
    c.advance(10);
    store.notify("second", "error");
    const [newest, older] = store.getSnapshot();
    expect(newest).toMatchObject({ message: "second", severity: "error", at: 1_010 });
    expect(older).toMatchObject({ message: "first", severity: "info", at: 1_000 });
    expect(newest.id).not.toBe(older.id);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries, dropping the oldest`, () => {
    const store = createNotificationStore();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) store.notify(`n${i}`);
    const list = store.getSnapshot();
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].message).toBe(`n${HISTORY_LIMIT + 4}`);
    expect(list[HISTORY_LIMIT - 1].message).toBe("n5");
  });

  it("clearHistory empties the list", () => {
    const store = createNotificationStore();
    store.notify("a");
    store.clearHistory();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = createNotificationStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.notify("a");
    store.clearHistory();
    store.clearHistory(); // already empty -- no change, no call
    unsubscribe();
    store.notify("b");
    expect(calls).toBe(2);
  });

  it("returns the same snapshot reference until something changes", () => {
    const store = createNotificationStore();
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);
    store.notify("a");
    expect(store.getSnapshot()).not.toBe(before);
  });
});

describe("cor-CORE.SHELL-000007: visibleNotification", () => {
  const n = (id: number, at: number): AppNotification => ({
    id,
    message: `m${id}`,
    severity: "info",
    at,
  });

  it("shows nothing when there are no notifications", () => {
    expect(visibleNotification([], 0)).toBeNull();
  });

  it(`shows the newest notification for ${CLEAR_AFTER_MS} ms, then clears`, () => {
    const list = [n(1, 1_000)];
    expect(visibleNotification(list, 1_000)?.id).toBe(1);
    expect(visibleNotification(list, 1_000 + CLEAR_AFTER_MS - 1)?.id).toBe(1);
    expect(visibleNotification(list, 1_000 + CLEAR_AFTER_MS)).toBeNull();
  });

  it("a newer notification replaces the older one and gets its own full time", () => {
    const list = [n(2, 4_000), n(1, 1_000)];
    expect(visibleNotification(list, 4_000)?.id).toBe(2);
    expect(visibleNotification(list, 4_000 + CLEAR_AFTER_MS - 1)?.id).toBe(2);
  });

  it("honors a custom clear delay", () => {
    expect(visibleNotification([n(1, 0)], 150, 100)).toBeNull();
  });
});
