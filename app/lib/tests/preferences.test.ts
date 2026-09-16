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
