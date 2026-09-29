import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Catalog } from "../catalog.ts";
import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from "../preferences.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-pref-test-"));
  dbPath = join(dir, "catalog.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Preferences", () => {
  it("returns default preferences when none are set", () => {
    const catalog = new Catalog(dbPath);
    const prefs = getPreferences(catalog);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    catalog.close();
  });

  it("persists and reads back updated preferences", () => {
    const catalog = new Catalog(dbPath);
    savePreferences(catalog, {
      defaultQueryLimit: 250,
      autoRefreshIntervalSeconds: 15,
      theme: "dark",
    });

    const prefs = getPreferences(catalog);
    expect(prefs.defaultQueryLimit).toBe(250);
    expect(prefs.autoRefreshIntervalSeconds).toBe(15);
    expect(prefs.theme).toBe("dark");

    catalog.close();
  });
});

// cor-CORE.SHELL-000008 (REQ-000030): the Settings/Appearance fields.
describe("cor-CORE.SHELL-000008: effective preferences", () => {
  it("defaults the new fields per the rule", () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({
      logHighlightWindowSeconds: 5,
      notificationClearSeconds: 5,
      highlightColor: "#eaff00",
      showStatusBar: true,
    });
  });

  it("round-trips every field", () => {
    const catalog = new Catalog(dbPath);
    const all = {
      defaultQueryLimit: 500,
      autoRefreshIntervalSeconds: 30,
      theme: "light" as const,
      logHighlightWindowSeconds: 12,
      notificationClearSeconds: 9,
      highlightColor: "#12ab34",
      showStatusBar: false,
    };
    expect(savePreferences(catalog, all)).toEqual(all);
    expect(getPreferences(catalog)).toEqual(all);
    catalog.close();
  });

  it("normalizes the highlight color to lowercase", () => {
    const catalog = new Catalog(dbPath);
    expect(savePreferences(catalog, { highlightColor: "#ABCDEF" }).highlightColor).toBe("#abcdef");
    catalog.close();
  });

  it("reads a missing or invalid stored value as its default", () => {
    const catalog = new Catalog(dbPath);
    catalog.setSetting("pref_logHighlightWindowSeconds", "0");
    catalog.setSetting("pref_notificationClearSeconds", "2.5");
    catalog.setSetting("pref_highlightColor", "yellow");
    catalog.setSetting("pref_showStatusBar", "yes");
    catalog.setSetting("pref_defaultQueryLimit", "abc");
    expect(getPreferences(catalog)).toEqual(DEFAULT_PREFERENCES);
    catalog.close();
  });

  it.each([
    [{ defaultQueryLimit: 0 }],
    [{ autoRefreshIntervalSeconds: -1 }],
    [{ logHighlightWindowSeconds: 1.5 }],
    [{ notificationClearSeconds: 0 }],
    [{ highlightColor: "#fff" }],
    [{ theme: "sepia" }],
    [{ showStatusBar: "false" }],
    [{ autoStartLocalSump: true }],
  ])("refuses to save %o and stores nothing", (update) => {
    const catalog = new Catalog(dbPath);
    expect(() =>
      savePreferences(catalog, { theme: "dark", ...(update as object) } as never),
    ).toThrow();
    expect(getPreferences(catalog).theme).toBe("system");
    catalog.close();
  });
});

// cor-CORE.SHELL-000009 (REQ-000032): Hard Reset of preferences.
describe("cor-CORE.SHELL-000009: resetPreferences", () => {
  it("deletes every stored preference and keeps other settings", async () => {
    const { resetPreferences } = await import("../preferences.ts");
    const catalog = new Catalog(dbPath);
    savePreferences(catalog, { theme: "dark", defaultQueryLimit: 7, showStatusBar: false });
    catalog.setPrimarySumpId("sump-1");
    catalog.setSetting("pref%other", "x"); // LIKE metacharacters in a non-pref key
    expect(resetPreferences(catalog)).toEqual(DEFAULT_PREFERENCES);
    expect(getPreferences(catalog)).toEqual(DEFAULT_PREFERENCES);
    expect(catalog.getPrimarySumpId()).toBe("sump-1");
    expect(catalog.getSetting("pref%other")).toBe("x");
    catalog.close();
  });
});
