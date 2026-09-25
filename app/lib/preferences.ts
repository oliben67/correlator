/**
 * Application preferences stored in catalog app_settings (cor-CORE.SHELL-000005).
 */

import type { Catalog } from "./catalog.ts";

export interface AppPreferences {
  defaultQueryLimit: number;
  autoRefreshIntervalSeconds: number;
  theme: "light" | "dark" | "system";
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultQueryLimit: 100,
  autoRefreshIntervalSeconds: 0, // 0 = disabled
  theme: "system",
};

const PREF_KEY_PREFIX = "pref_";

export function getPreferences(catalog: Catalog): AppPreferences {
  const prefs: AppPreferences = { ...DEFAULT_PREFERENCES };

  const limitStr = catalog.getSetting(`${PREF_KEY_PREFIX}defaultQueryLimit`);
  if (limitStr) {
    const parsed = Number(limitStr);
    if (!Number.isNaN(parsed) && parsed > 0) {
      prefs.defaultQueryLimit = parsed;
    }
  }

  const intervalStr = catalog.getSetting(`${PREF_KEY_PREFIX}autoRefreshIntervalSeconds`);
  if (intervalStr) {
    const parsed = Number(intervalStr);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      prefs.autoRefreshIntervalSeconds = parsed;
    }
  }

  const themeStr = catalog.getSetting(`${PREF_KEY_PREFIX}theme`);
  if (themeStr === "light" || themeStr === "dark" || themeStr === "system") {
    prefs.theme = themeStr;
  }

  return prefs;
}

export function savePreferences(
  catalog: Catalog,
  updates: Partial<AppPreferences>,
): AppPreferences {
  if (updates.defaultQueryLimit !== undefined) {
    catalog.setSetting(`${PREF_KEY_PREFIX}defaultQueryLimit`, String(updates.defaultQueryLimit));
  }

  if (updates.autoRefreshIntervalSeconds !== undefined) {
    catalog.setSetting(
      `${PREF_KEY_PREFIX}autoRefreshIntervalSeconds`,
      String(updates.autoRefreshIntervalSeconds),
    );
  }

  if (updates.theme !== undefined) {
    catalog.setSetting(`${PREF_KEY_PREFIX}theme`, updates.theme);
  }

  return getPreferences(catalog);
}
