import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  preferenceEffects,
  toPreferenceForm,
  validatePreferenceForm,
} from "../appPreferences.js";
import { PreferencesForm } from "../Preferences.js";

// cor-CORE.SHELL-000008 (REQ-000030): preference effects + form validation.

describe("cor-CORE.SHELL-000008: preferenceEffects", () => {
  it("maps the defaults to their effects", () => {
    expect(preferenceEffects(DEFAULT_PREFERENCES)).toEqual({
      highlightWindowMs: 5000,
      notificationClearMs: 5000,
      highlightColor: "#eaff00",
      showStatusBar: true,
      queryLimit: 100,
      autoRefreshMs: null,
    });
  });

  it("converts seconds to ms and turns a positive refresh interval on", () => {
    const e = preferenceEffects({
      ...DEFAULT_PREFERENCES,
      logHighlightWindowSeconds: 2,
      notificationClearSeconds: 8,
      autoRefreshIntervalSeconds: 30,
      defaultQueryLimit: 250,
      showStatusBar: false,
    });
    expect(e).toMatchObject({
      highlightWindowMs: 2000,
      notificationClearMs: 8000,
      autoRefreshMs: 30_000,
      queryLimit: 250,
      showStatusBar: false,
    });
  });
});

describe("cor-CORE.SHELL-000008: validatePreferenceForm", () => {
  const form = toPreferenceForm(DEFAULT_PREFERENCES);

  it("accepts the defaults and round-trips them", () => {
    expect(validatePreferenceForm(form)).toEqual({ ok: true, prefs: DEFAULT_PREFERENCES });
  });

  it("lowercases the highlight color", () => {
    const result = validatePreferenceForm({ ...form, highlightColor: "#ABCDEF" });
    expect(result.ok && result.prefs.highlightColor).toBe("#abcdef");
  });

  it("allows auto-refresh 0 (off) but not a 0 highlight window or notification time", () => {
    const result = validatePreferenceForm({
      ...form,
      autoRefreshIntervalSeconds: "0",
      logHighlightWindowSeconds: "0",
      notificationClearSeconds: "0",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "logHighlightWindowSeconds",
      "notificationClearSeconds",
    ]);
  });

  it.each([
    ["defaultQueryLimit", "0"],
    ["defaultQueryLimit", "2.5"],
    ["defaultQueryLimit", ""],
    ["autoRefreshIntervalSeconds", "-1"],
    ["highlightColor", "yellow"],
    ["highlightColor", "#fff"],
  ] as const)("rejects %s = %j", (key, value) => {
    const result = validatePreferenceForm({ ...form, [key]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[key]).toBeTruthy();
  });
});

describe("cor-CORE.SHELL-000008: PreferencesForm", () => {
  const render = (overrides: Partial<Parameters<typeof PreferencesForm>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(PreferencesForm, {
        form: toPreferenceForm(DEFAULT_PREFERENCES),
        errors: {},
        saving: false,
        onChange: () => {},
        onSave: () => {},
        onReset: () => {},
        ...overrides,
      }),
    );

  it("renders the Settings and Appearance panes with every effective field", () => {
    const markup = render();
    expect(markup).toContain("Settings");
    expect(markup).toContain("Appearance");
    for (const name of [
      "defaultQueryLimit",
      "autoRefreshIntervalSeconds",
      "logHighlightWindowSeconds",
      "notificationClearSeconds",
      "theme",
      "highlightColor",
      "showStatusBar",
    ]) {
      expect(markup).toContain(`name="${name}"`);
    }
    expect(markup).toContain('value="#eaff00"');
    expect(markup).toMatch(/name="showStatusBar"[^>]*checked/);
  });

  it("offers no field for features correlator doesn't have yet", () => {
    const markup = render().toLowerCase();
    for (const absent of [
      "live-track",
      "livetrack",
      "now line",
      "capture band",
      "sprocket",
      "autostart",
    ]) {
      expect(markup).not.toContain(absent);
    }
  });

  it("shows a field's validation message", () => {
    const markup = render({
      errors: { defaultQueryLimit: "Must be a whole number of at least 1." },
    });
    expect(markup).toContain("Must be a whole number of at least 1.");
  });

  it("disables Save and Reset while saving", () => {
    expect(render({ saving: true }).match(/<button[^>]*disabled/g)).toHaveLength(2);
  });
});
