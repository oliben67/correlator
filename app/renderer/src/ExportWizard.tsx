import { useState } from "react";
import { Button } from "./components/Button.js";
import { Dialog } from "./components/Dialog.js";
import { notify } from "./notifications.js";
import {
  buildProjectExport,
  type ExportFormat,
  type ExportGranularity,
  type ExportItem,
  exportFileName,
  exportToText,
} from "./projectExport.js";

// cor-CORE.EXPORT-000004 (REQ-000041, RM-000044): cttc's two-step Export
// Metrics wizard -- what to include, then the format -- for the Project
// view's visible, loaded files.

export interface ExportChoices {
  metrics: boolean;
  logs: boolean;
  format: ExportFormat;
  granularity: ExportGranularity;
}

export const DEFAULT_EXPORT_CHOICES: ExportChoices = {
  metrics: true,
  logs: true,
  format: "text",
  granularity: "summary",
};

export interface ExportWizardBodyProps {
  step: 1 | 2;
  choices: ExportChoices;
  busy?: boolean;
  onChange: (choices: ExportChoices) => void;
  onNext: () => void;
  onBack: () => void;
  onExport: () => void;
}

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, margin: "6px 0" };

function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={pressed ? "primary" : "default"} aria-pressed={pressed} onClick={onClick}>
      {children}
    </Button>
  );
}

/** The wizard's content for one step (stateless, so both steps render-test). */
export function ExportWizardBody({
  step,
  choices,
  busy = false,
  onChange,
  onNext,
  onBack,
  onExport,
}: ExportWizardBodyProps) {
  const set = (patch: Partial<ExportChoices>) => onChange({ ...choices, ...patch });
  if (step === 1) {
    return (
      <div data-export-step="1">
        <p style={{ marginTop: 0 }}>What to include</p>
        <label style={row}>
          <input
            type="checkbox"
            name="metrics"
            checked={choices.metrics}
            onChange={(e) => set({ metrics: e.target.checked })}
          />
          Metrics (tracks)
        </label>
        <label style={row}>
          <input
            type="checkbox"
            name="logs"
            checked={choices.logs}
            onChange={(e) => set({ logs: e.target.checked })}
          />
          Logs (recordings)
        </label>
        <div style={{ ...row, justifyContent: "flex-end" }}>
          <Button variant="primary" disabled={!choices.metrics && !choices.logs} onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div data-export-step="2">
      <div style={row}>
        <span>Format</span>
        <Choice pressed={choices.format === "text"} onClick={() => set({ format: "text" })}>
          Text
        </Choice>
        <Choice pressed={choices.format === "json"} onClick={() => set({ format: "json" })}>
          JSON
        </Choice>
      </div>
      {choices.metrics && (
        <div style={row} data-export-detail="">
          <span>Metrics detail</span>
          <Choice
            pressed={choices.granularity === "summary"}
            onClick={() => set({ granularity: "summary" })}
          >
            Summary
          </Choice>
          <Choice
            pressed={choices.granularity === "full"}
            onClick={() => set({ granularity: "full" })}
          >
            Full series
          </Choice>
        </div>
      )}
      <div style={{ ...row, justifyContent: "space-between" }}>
        <Button onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" onClick={onExport} disabled={busy}>
          Export
        </Button>
      </div>
    </div>
  );
}

export interface ExportWizardProps {
  open: boolean;
  onClose: () => void;
  items: readonly ExportItem[];
}

export function ExportWizard({ open, onClose, items }: ExportWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [choices, setChoices] = useState(DEFAULT_EXPORT_CHOICES);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep(1);
    onClose();
  };

  const runExport = async () => {
    const data = buildProjectExport(items, choices);
    const content =
      choices.format === "json" ? `${JSON.stringify(data, null, 2)}\n` : exportToText(data);
    setBusy(true);
    try {
      const saved = await window.correlator.saveExportFile({
        defaultName: exportFileName(choices.format),
        content,
      });
      if (saved) {
        notify(`Exported to ${saved.filePath}`);
        close();
      }
    } catch (err) {
      notify(`Export failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Export">
      <ExportWizardBody
        step={step}
        choices={choices}
        busy={busy}
        onChange={setChoices}
        onNext={() => setStep(2)}
        onBack={() => setStep(1)}
        onExport={() => {
          void runExport();
        }}
      />
    </Dialog>
  );
}
