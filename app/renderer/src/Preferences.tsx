import { useAtomValue, useSetAtom } from "jotai/react";
import { type CSSProperties, useEffect, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  type PreferenceForm,
  preferencesAtom,
  toPreferenceForm,
  validatePreferenceForm,
} from "./appPreferences.js";
import { Button } from "./components/Button.js";
import { Panel } from "./components/Panel.js";
import { notify } from "./notifications.js";

// cor-CORE.SHELL-000008 (REQ-000030, RM-000047): Settings + Appearance,
// modelled on cttc's panes but limited to what correlator can control --
// every field here takes effect.

type FormErrors = Partial<Record<keyof PreferenceForm, string>>;

const fieldStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const errorStyle: CSSProperties = { color: "var(--critical)", fontSize: "0.85em" };
const paneStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

export interface PreferencesFormProps {
  form: PreferenceForm;
  errors: FormErrors;
  saving: boolean;
  onChange: (next: PreferenceForm) => void;
  onSave: () => void;
  onReset: () => void;
}

export function PreferencesForm({
  form,
  errors,
  saving,
  onChange,
  onSave,
  onReset,
}: PreferencesFormProps) {
  const set = <K extends keyof PreferenceForm>(key: K, value: PreferenceForm[K]) =>
    onChange({ ...form, [key]: value });

  const numberField = (key: keyof PreferenceForm, label: string, min: number) => (
    <label style={fieldStyle}>
      <span>{label}</span>
      <input
        type="number"
        name={key}
        min={min}
        step={1}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
      />
      {errors[key] && <span style={errorStyle}>{errors[key]}</span>}
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}
    >
      <Panel>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div style={paneStyle}>
          {numberField("defaultQueryLimit", "Records fetched per load", 1)}
          {numberField("autoRefreshIntervalSeconds", "Auto-refresh every (seconds, 0 = off)", 0)}
          {numberField(
            "logHighlightWindowSeconds",
            "Log highlight window around the cursor (± seconds)",
            1,
          )}
          {numberField("notificationClearSeconds", "Status-bar notifications stay (seconds)", 1)}
        </div>
      </Panel>

      <Panel>
        <h3 style={{ marginTop: 0 }}>Appearance</h3>
        <div style={paneStyle}>
          <label style={fieldStyle}>
            <span>Theme</span>
            <select
              name="theme"
              value={form.theme}
              onChange={(e) => set("theme", e.target.value as PreferenceForm["theme"])}
            >
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Log highlight color</span>
            <input
              type="color"
              name="highlightColor"
              value={form.highlightColor}
              onChange={(e) => set("highlightColor", e.target.value)}
            />
            {errors.highlightColor && <span style={errorStyle}>{errors.highlightColor}</span>}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="showStatusBar"
              checked={form.showStatusBar}
              onChange={(e) => set("showStatusBar", e.target.checked)}
            />
            <span>Show status bar</span>
          </label>
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" variant="primary" disabled={saving}>
          Save
        </Button>
        <Button onClick={onReset} disabled={saving}>
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}

export function Preferences() {
  const saved = useAtomValue(preferencesAtom);
  const setSaved = useSetAtom(preferencesAtom);
  const [form, setForm] = useState<PreferenceForm>(() => toPreferenceForm(saved));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Follow the saved preferences once App's loader has fetched them.
  useEffect(() => {
    setForm(toPreferenceForm(saved));
  }, [saved]);

  const handleSave = async () => {
    const result = validatePreferenceForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      notify("Preferences not saved: fix the highlighted fields", "error");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // Applies at once: every consumer reads preferencesAtom.
      setSaved(await window.correlator.setPreferences(result.prefs));
      notify("Preferences saved");
    } catch (err) {
      notify(
        `Could not save preferences: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Preferences</h2>
      <PreferencesForm
        form={form}
        errors={errors}
        saving={saving}
        onChange={setForm}
        onSave={handleSave}
        onReset={() => {
          setErrors({});
          setForm(toPreferenceForm(DEFAULT_PREFERENCES));
        }}
      />
    </div>
  );
}
