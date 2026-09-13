import { useState } from "react";
import { AddSump } from "./AddSump.js";
import type { SumpSummary } from "./correlator-api.js";

// cor-CORE.PROVISION-007: renders every live Sump with a "Set as primary"
// action, an inline rename control, and an Uninstall/Disconnect action.
// Same zero-CSS-framework, plain-inline-style convention as AddSump.tsx.

type ActionState = { phase: "idle" } | { phase: "pending" } | { phase: "error"; message: string };

const rowStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 4,
  marginBottom: 8,
  padding: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function uninstallLabel(sump: SumpSummary): string {
  return sump.connectionType === "external" ? "Disconnect" : "Uninstall";
}

export function SumpSwitcher({
  sumps,
  primaryId,
  onChange,
}: {
  sumps: SumpSummary[];
  primaryId: string | null;
  onChange: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingAnother, setAddingAnother] = useState(false);
  const [action, setAction] = useState<ActionState>({ phase: "idle" });

  const pending = action.phase === "pending";

  async function run(work: () => Promise<void>) {
    setAction({ phase: "pending" });
    try {
      await work();
      setAction({ phase: "idle" });
      onChange();
    } catch (err) {
      setAction({ phase: "error", message: errorMessage(err) });
    }
  }

  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {sumps.map((sump) => (
          <li key={sump.id} style={rowStyle}>
            {renaming === sump.id ? (
              <>
                <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      await window.correlator.renameSump({ sumpId: sump.id, name: renameValue });
                      setRenaming(null);
                    })
                  }
                >
                  Save
                </button>
                <button type="button" onClick={() => setRenaming(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>
                  {sump.name} — {sump.status}
                  {sump.id === primaryId ? " (primary)" : ""}
                </span>
                <button
                  type="button"
                  disabled={pending || sump.id === primaryId}
                  onClick={() =>
                    run(async () => {
                      await window.correlator.selectPrimarySump({ sumpId: sump.id });
                    })
                  }
                >
                  Set as primary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(sump.id);
                    setRenameValue(sump.name);
                  }}
                >
                  Rename
                </button>
                {sump.parentSumpId === null && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await window.correlator.uninstallSump({ sumpId: sump.id });
                      })
                    }
                  >
                    {uninstallLabel(sump)}
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {action.phase === "error" && <p role="alert">{action.message}</p>}

      <button type="button" onClick={() => setAddingAnother((current) => !current)}>
        Add another Sump
      </button>
      {addingAnother && (
        <AddSump
          heading={null}
          onSumpAdded={() => {
            setAddingAnother(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}
