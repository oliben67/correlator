import { atom } from "jotai";
import { useAtomValue, useSetAtom } from "jotai/react";
import { useEffect } from "react";
import { DEFAULT_PREFERENCES } from "../../lib/preferences.js";
import { liveOptionsAtom, windowMsAtom } from "./correlate/atoms.js";
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
  /** cor-CORE.CORRELATE-000011: values for the now-line and live-track color tokens. */
  nowLineColor: string;
  liveTrackColor: string;
  nowLineStyle: AppPreferencesSummary["nowLineStyle"];
  liveTrackEnabled: boolean;
  liveTrackOffsetMs: number;
  recenterResumeMs: number;
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
    nowLineColor: prefs.nowLineColor,
    liveTrackColor: prefs.liveTrackColor,
    nowLineStyle: prefs.nowLineStyle,
    liveTrackEnabled: prefs.liveTrackEnabled,
    liveTrackOffsetMs: prefs.liveTrackOffsetSeconds * 1000,
    recenterResumeMs: prefs.recenterResumeSeconds * 1000,
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
  nowLineColor: string;
  nowLineStyle: AppPreferencesSummary["nowLineStyle"];
  liveTrackColor: string;
  liveTrackEnabled: boolean;
  liveTrackOffsetSeconds: string;
  recenterResumeSeconds: string;
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
    nowLineColor: prefs.nowLineColor,
    nowLineStyle: prefs.nowLineStyle,
    liveTrackColor: prefs.liveTrackColor,
    liveTrackEnabled: prefs.liveTrackEnabled,
    liveTrackOffsetSeconds: String(prefs.liveTrackOffsetSeconds),
    recenterResumeSeconds: String(prefs.recenterResumeSeconds),
  };
}

export type PreferenceFormResult =
  | { ok: true; prefs: AppPreferencesSummary }
  | { ok: false; errors: Partial<Record<keyof PreferenceForm, string>> };

function integerField(raw: string, min: number, max = Number.POSITIVE_INFINITY): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const HEX = /^#[0-9a-f]{6}$/;

/** Validates the form against cor-CORE.SHELL-000008's validity column. */
export function validatePreferenceForm(form: PreferenceForm): PreferenceFormResult {
  const errors: Partial<Record<keyof PreferenceForm, string>> = {};
  const int = (key: keyof PreferenceForm, min: number, message: string, max?: number) => {
    const n = integerField(form[key] as string, min, max);
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
    nowLineColor: form.nowLineColor.toLowerCase(),
    nowLineStyle: form.nowLineStyle,
    liveTrackColor: form.liveTrackColor.toLowerCase(),
    liveTrackEnabled: form.liveTrackEnabled,
    liveTrackOffsetSeconds: int(
      "liveTrackOffsetSeconds",
      Number.NEGATIVE_INFINITY,
      "Must be a whole number of seconds, 0 or less.",
      0,
    ),
    recenterResumeSeconds: int(
      "recenterResumeSeconds",
      0,
      "Must be a whole number of seconds (0 = never).",
    ),
  };
  for (const key of ["highlightColor", "nowLineColor", "liveTrackColor"] as const) {
    if (!HEX.test(prefs[key])) errors[key] = "Must be a color like #eaff00.";
  }
  return Object.keys(errors).length === 0 ? { ok: true, prefs } : { ok: false, errors };
}

/** Loads the saved preferences into this window and applies the effects
 * that live outside React state (highlight window and live-mark atoms, and
 * the highlight, now-line and live-track color tokens). */
export function usePreferences(): AppPreferencesSummary {
  const prefs = useAtomValue(preferencesAtom);
  const setPrefs = useSetAtom(preferencesAtom);
  const setWindowMs = useSetAtom(windowMsAtom);
  const setLiveOptions = useSetAtom(liveOptionsAtom);

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
    setLiveOptions({
      nowLineStyle: effects.nowLineStyle,
      liveTrackEnabled: effects.liveTrackEnabled,
      liveTrackOffsetMs: effects.liveTrackOffsetMs,
      recenterResumeMs: effects.recenterResumeMs,
    });
    const root = document.documentElement.style;
    root.setProperty("--hl-color", effects.highlightColor);
    root.setProperty("--now-line-color", effects.nowLineColor);
    root.setProperty("--live-track-color", effects.liveTrackColor);
  }, [prefs, setWindowMs, setLiveOptions]);

  return prefs;
}
