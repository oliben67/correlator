/**
 * Application preferences stored in catalog app_settings (cor-CORE.SHELL-000005),
 * every one of which takes effect somewhere (cor-CORE.SHELL-000008).
 */

import type { Catalog } from "./catalog.ts";

export type ThemeMode = "light" | "dark" | "system";
export type NowLineStyle = "dotted" | "dashed" | "solid";

export interface AppPreferences {
  /** Record fetch limit of the Correlate view's load. */
  defaultQueryLimit: number;
  /** How often the Correlate view reloads, in seconds; 0 = off. */
  autoRefreshIntervalSeconds: number;
  theme: ThemeMode;
  /** ± window around the cursor that highlights log rows, in seconds. */
  logHighlightWindowSeconds: number;
  /** How long a status-bar notification stays, in seconds. */
  notificationClearSeconds: number;
  /** `--hl-color` override, `#rrggbb`. */
  highlightColor: string;
  showStatusBar: boolean;
  /** cor-CORE.CORRELATE-000011: the now line's color, `#rrggbb`. */
  nowLineColor: string;
  nowLineStyle: NowLineStyle;
  /** The live-track marker's color, `#rrggbb`. */
  liveTrackColor: string;
  liveTrackEnabled: boolean;
  /** Where the live-track marker sits relative to now, in seconds (≤ 0). */
  liveTrackOffsetSeconds: number;
  /** Delay before a recenter that interrupted live resumes it; 0 = never. */
  recenterResumeSeconds: number;
  /** cor-CORE.CORRELATE-000012: the captured-range band's color, `#rrggbb`. */
  recordingBandColor: string;
  /** Sprocket holes along the band on chart strips. */
  recordingSprocketHoles: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultQueryLimit: 100,
  autoRefreshIntervalSeconds: 0,
  theme: "system",
  logHighlightWindowSeconds: 5,
  notificationClearSeconds: 5,
  highlightColor: "#eaff00",
  showStatusBar: true,
  nowLineColor: "#14b8a6",
  nowLineStyle: "dotted",
  liveTrackColor: "#22c55e",
  liveTrackEnabled: true,
  liveTrackOffsetSeconds: 0,
  recenterResumeSeconds: 10,
  recordingBandColor: "#fab219",
  recordingSprocketHoles: true,
};

const PREF_KEY_PREFIX = "pref_";

interface FieldSpec<T> {
  /** Parse a stored string; null when missing or invalid. */
  parse(raw: string): T | null;
  valid(value: unknown): value is T;
  serialize(value: T): string;
}

const integerAtLeast = (min: number): FieldSpec<number> => ({
  parse(raw) {
    const n = Number(raw);
    return Number.isInteger(n) && n >= min ? n : null;
  },
  valid: (v): v is number => typeof v === "number" && Number.isInteger(v) && v >= min,
  serialize: String,
});

const integerAtMost = (max: number): FieldSpec<number> => ({
  parse(raw) {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isInteger(n) && n <= max ? n : null;
  },
  valid: (v): v is number => typeof v === "number" && Number.isInteger(v) && v <= max,
  serialize: String,
});

const oneOf = <T extends string>(values: readonly T[]): FieldSpec<T> => ({
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : null),
  valid: (v): v is T => values.includes(v as T),
  serialize: String,
});

const THEMES: readonly ThemeMode[] = ["light", "dark", "system"];
const NOW_LINE_STYLES: readonly NowLineStyle[] = ["dotted", "dashed", "solid"];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const hexColor: FieldSpec<string> = {
  parse: (raw) => (HEX_COLOR.test(raw) ? raw.toLowerCase() : null),
  valid: (v): v is string => typeof v === "string" && HEX_COLOR.test(v),
  serialize: (v) => v.toLowerCase(),
};

const boolean: FieldSpec<boolean> = {
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
  valid: (v): v is boolean => typeof v === "boolean",
  serialize: String,
};

const FIELDS: { [K in keyof AppPreferences]: FieldSpec<AppPreferences[K]> } = {
  defaultQueryLimit: integerAtLeast(1),
  autoRefreshIntervalSeconds: integerAtLeast(0),
  logHighlightWindowSeconds: integerAtLeast(1),
  notificationClearSeconds: integerAtLeast(1),
  theme: oneOf(THEMES),
  highlightColor: hexColor,
  showStatusBar: boolean,
  nowLineColor: hexColor,
  nowLineStyle: oneOf(NOW_LINE_STYLES),
  liveTrackColor: hexColor,
  liveTrackEnabled: boolean,
  liveTrackOffsetSeconds: integerAtMost(0),
  recenterResumeSeconds: integerAtLeast(0),
  recordingBandColor: hexColor,
  recordingSprocketHoles: boolean,
};

const FIELD_NAMES = Object.keys(FIELDS) as (keyof AppPreferences)[];

/** Stored preferences; a missing or invalid value reads as its default. */
export function getPreferences(catalog: Catalog): AppPreferences {
  const prefs: AppPreferences = { ...DEFAULT_PREFERENCES };
  for (const name of FIELD_NAMES) {
    const raw = catalog.getSetting(`${PREF_KEY_PREFIX}${name}`);
    if (raw === null || raw === undefined) continue;
    const parsed = FIELDS[name].parse(raw);
    if (parsed !== null) (prefs as unknown as Record<string, unknown>)[name] = parsed;
  }
  return prefs;
}

/** cor-CORE.SHELL-000009 (Hard Reset): deletes every stored preference so
 * all of them read as their defaults again; other settings are kept. */
export function resetPreferences(catalog: Catalog): AppPreferences {
  catalog.deleteSettingsWithPrefix(PREF_KEY_PREFIX);
  return getPreferences(catalog);
}

/** Saves the given fields. Throws, storing nothing, if any given value is
 * invalid or any key is unknown. */
export function savePreferences(
  catalog: Catalog,
  updates: Partial<AppPreferences>,
): AppPreferences {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  for (const [name, value] of entries) {
    const spec = FIELDS[name as keyof AppPreferences] as FieldSpec<unknown> | undefined;
    if (!spec) throw new Error(`Unknown preference "${name}"`);
    if (!spec.valid(value)) throw new Error(`Invalid value for preference "${name}"`);
  }
  for (const [name, value] of entries) {
    const spec = FIELDS[name as keyof AppPreferences] as FieldSpec<unknown>;
    catalog.setSetting(`${PREF_KEY_PREFIX}${name}`, spec.serialize(value));
  }
  return getPreferences(catalog);
}
