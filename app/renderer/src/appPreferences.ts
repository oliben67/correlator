import { atom } from "jotai";
import { useAtomValue, useSetAtom } from "jotai/react";
import { useEffect } from "react";
import { DEFAULT_PREFERENCES } from "../../lib/preferences.js";
import { windowMsAtom } from "./correlate/atoms.js";
import type { AppPreferencesSummary } from "./correlator-api.js";

// cor-CORE.SHELL-000008 (REQ-000030): every offered preference takes
// effect. One atom holds the saved preferences for the whole window; each
// window loads them on open (usePreferences) and Preferences.tsx writes
// the saved result back, so a change applies at once.

export { DEFAULT_PREFERENCES };

export const preferencesAtom = atom<AppPreferencesSummary>({ ...DEFAULT_PREFERENCES });

export interface PreferenceEffects {
  /** ± log-row highlight window around the cursor (cor-CORE.CORRELATE-000004). */
  highlightWindowMs: number;
  /** Status-bar notification display time (cor-CORE.SHELL-000007). */
  notificationClearMs: number;
  /** Value for the `--hl-color` token. */
  highlightColor: string;
  showStatusBar: boolean;
  /** Record fetch limit for the Correlate view and detached panels. */
  queryLimit: number;
  /** Correlate auto-reload period, or null when off. */
  autoRefreshMs: number | null;
}

export function preferenceEffects(prefs: AppPreferencesSummary): PreferenceEffects {
  return {
    highlightWindowMs: prefs.logHighlightWindowSeconds * 1000,
    notificationClearMs: prefs.notificationClearSeconds * 1000,
    highlightColor: prefs.highlightColor,
    showStatusBar: prefs.showStatusBar,
    queryLimit: prefs.defaultQueryLimit,
    autoRefreshMs:
      prefs.autoRefreshIntervalSeconds > 0 ? prefs.autoRefreshIntervalSeconds * 1000 : null,
  };
}

/** The Preferences form's raw field values. */
export interface PreferenceForm {
  defaultQueryLimit: string;
  autoRefreshIntervalSeconds: string;
  logHighlightWindowSeconds: string;
  notificationClearSeconds: string;
  theme: AppPreferencesSummary["theme"];
  highlightColor: string;
  showStatusBar: boolean;
}

export function toPreferenceForm(prefs: AppPreferencesSummary): PreferenceForm {
  return {
    defaultQueryLimit: String(prefs.defaultQueryLimit),
    autoRefreshIntervalSeconds: String(prefs.autoRefreshIntervalSeconds),
    logHighlightWindowSeconds: String(prefs.logHighlightWindowSeconds),
    notificationClearSeconds: String(prefs.notificationClearSeconds),
    theme: prefs.theme,
    highlightColor: prefs.highlightColor,
    showStatusBar: prefs.showStatusBar,
  };
}

export type PreferenceFormResult =
  | { ok: true; prefs: AppPreferencesSummary }
  | { ok: false; errors: Partial<Record<keyof PreferenceForm, string>> };

function integerField(raw: string, min: number): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : null;
}

/** Validates the form against cor-CORE.SHELL-000008's validity column. */
export function validatePreferenceForm(form: PreferenceForm): PreferenceFormResult {
  const errors: Partial<Record<keyof PreferenceForm, string>> = {};
  const int = (key: keyof PreferenceForm, min: number, message: string) => {
    const n = integerField(form[key] as string, min);
    if (n === null) errors[key] = message;
    return n ?? 0;
  };
  const prefs: AppPreferencesSummary = {
    defaultQueryLimit: int("defaultQueryLimit", 1, "Must be a whole number of at least 1."),
    autoRefreshIntervalSeconds: int(
      "autoRefreshIntervalSeconds",
      0,
      "Must be a whole number of seconds (0 = off).",
    ),
    logHighlightWindowSeconds: int(
      "logHighlightWindowSeconds",
      1,
      "Must be a whole number of at least 1 second.",
    ),
    notificationClearSeconds: int(
      "notificationClearSeconds",
      1,
      "Must be a whole number of at least 1 second.",
    ),
    theme: form.theme,
    highlightColor: form.highlightColor.toLowerCase(),
    showStatusBar: form.showStatusBar,
  };
  if (!/^#[0-9a-f]{6}$/.test(prefs.highlightColor)) {
    errors.highlightColor = "Must be a color like #eaff00.";
  }
  return Object.keys(errors).length === 0 ? { ok: true, prefs } : { ok: false, errors };
}

/** Loads the saved preferences into this window and applies the effects
 * that live outside React state (highlight window atom, --hl-color). */
export function usePreferences(): AppPreferencesSummary {
  const prefs = useAtomValue(preferencesAtom);
  const setPrefs = useSetAtom(preferencesAtom);
  const setWindowMs = useSetAtom(windowMsAtom);

  useEffect(() => {
    let cancelled = false;
    window.correlator
      .getPreferences()
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch(() => {
        // Keep the defaults -- a window must still work if the catalog
        // can't be read.
      });
    return () => {
      cancelled = true;
    };
  }, [setPrefs]);

  useEffect(() => {
    const effects = preferenceEffects(prefs);
    setWindowMs(effects.highlightWindowMs);
    document.documentElement.style.setProperty("--hl-color", effects.highlightColor);
  }, [prefs, setWindowMs]);

  return prefs;
}
