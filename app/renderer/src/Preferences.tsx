import { useEffect, useState } from "react";
import type { AppPreferencesSummary } from "./correlator-api.d.ts";

export function Preferences() {
  const [prefs, setPrefs] = useState<AppPreferencesSummary | null>(null);
  const [queryLimit, setQueryLimit] = useState("100");
  const [refreshInterval, setRefreshInterval] = useState("0");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    window.correlator.getPreferences().then((p) => {
      if (isMounted) {
        setPrefs(p);
        setQueryLimit(String(p.defaultQueryLimit));
        setRefreshInterval(String(p.autoRefreshIntervalSeconds));
        setTheme(p.theme);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = Number(queryLimit);
    const intervalNum = Number(refreshInterval);

    if (Number.isNaN(limitNum) || limitNum <= 0) {
      setSaveStatus("Error: Default Query Limit must be a positive integer.");
      return;
    }

    if (Number.isNaN(intervalNum) || intervalNum < 0) {
      setSaveStatus("Error: Auto Refresh Interval must be a non-negative integer.");
      return;
    }

    try {
      const updated = await window.correlator.setPreferences({
        defaultQueryLimit: limitNum,
        autoRefreshIntervalSeconds: intervalNum,
        theme,
      });
      setPrefs(updated);
      setSaveStatus("Preferences saved successfully!");
    } catch (err) {
      setSaveStatus(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!prefs) {
    return <p>Loading preferences...</p>;
  }

  return (
    <div style={{ padding: "16px", maxWidth: "500px" }}>
      <h2>Application Preferences</h2>

      {saveStatus && (
        <p style={{ color: saveStatus.startsWith("Error") ? "#dc3545" : "#198754" }}>
          {saveStatus}
        </p>
      )}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span>Default Query Limit (records per page):</span>
          <input
            type="number"
            value={queryLimit}
            onChange={(e) => setQueryLimit(e.target.value)}
            required
            min={1}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span>Auto Refresh Interval (seconds, 0 = disabled):</span>
          <input
            type="number"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(e.target.value)}
            required
            min={0}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span>Appearance Theme:</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}>
            <option value="system">System Default</option>
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>
        </label>

        <button type="submit" style={{ width: "120px", marginTop: "8px" }}>
          Save Settings
        </button>
      </form>
    </div>
  );
}
