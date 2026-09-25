import { useEffect, useState } from "react";
import { AddSump } from "./AddSump.js";
import { Button } from "./components/Button.js";
import { Dialog } from "./components/Dialog.js";
import { Panel } from "./components/Panel.js";
import type { SumpSummary } from "./correlator-api.js";

// cor-CORE.PROVISION-007: renders every live Sump with a "Set as primary"
// action, an inline rename control, an Edit-connection-details control
// (RM-000027), and an Uninstall/Disconnect action.

type ActionState = { phase: "idle" } | { phase: "pending" } | { phase: "error"; message: string };

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: 8 };
const fieldStyle: React.CSSProperties = { display: "block", marginBottom: 8 };

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
  const [editing, setEditing] = useState<SumpSummary | null>(null);
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
          <li key={sump.id}>
            <Panel style={rowStyle}>
              {renaming === sump.id ? (
                <>
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                  <Button
                    variant="primary"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await window.correlator.renameSump({ sumpId: sump.id, name: renameValue });
                        setRenaming(null);
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button onClick={() => setRenaming(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span>
                    {sump.name} — {sump.status}
                    {sump.id === primaryId ? " (primary)" : ""}
                  </span>
                  <Button
                    disabled={pending || sump.id === primaryId}
                    onClick={() =>
                      run(async () => {
                        await window.correlator.selectPrimarySump({ sumpId: sump.id });
                      })
                    }
                  >
                    Set as primary
                  </Button>
                  <Button
                    onClick={() => {
                      setRenaming(sump.id);
                      setRenameValue(sump.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button onClick={() => setEditing(sump)}>Edit</Button>
                  {sump.parentSumpId === null && (
                    <Button
                      variant="danger"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          await window.correlator.uninstallSump({ sumpId: sump.id });
                        })
                      }
                    >
                      {uninstallLabel(sump)}
                    </Button>
                  )}
                </>
              )}
            </Panel>
          </li>
        ))}
      </ul>

      {action.phase === "error" && <p role="alert">{action.message}</p>}

      <Button onClick={() => setAddingAnother(true)}>Add another Sump</Button>
      <Dialog open={addingAnother} onClose={() => setAddingAnother(false)} title="Add a Sump">
        <AddSump
          heading={null}
          onSumpAdded={() => {
            setAddingAnother(false);
            onChange();
          }}
        />
      </Dialog>

      <EditSumpDialog
        sump={editing}
        pending={pending}
        onClose={() => setEditing(null)}
        onSave={(updates) =>
          run(async () => {
            if (!editing) return;
            await window.correlator.updateSumpConnection({ sumpId: editing.id, ...updates });
            setEditing(null);
          })
        }
      />
    </div>
  );
}

function EditSumpDialog({
  sump,
  pending,
  onClose,
  onSave,
}: {
  sump: SumpSummary | null;
  pending: boolean;
  onClose: () => void;
  onSave: (updates: { host: string; port: number; authToken?: string }) => void;
}) {
  // RM-000027: edits an existing Sump's connection details -- previously
  // the only fix for a wrong host/port/token was uninstalling and
  // re-adding the Sump from scratch.
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [authToken, setAuthToken] = useState("");

  // Re-seed the form fields every time a *different* Sump is opened for
  // editing. `sump` (the parent's `editing` state) only ever changes
  // reference when the parent explicitly opens/closes this dialog for a
  // (possibly different) Sump -- never spuriously on an unrelated
  // re-render -- so depending on the whole object is safe here and also
  // correctly re-syncs if the dialog is dismissed via the native
  // Escape/"cancel" path, which bypasses the Cancel button's own click
  // handler.
  useEffect(() => {
    setHost(sump?.host ?? "");
    setPort(sump?.port ? String(sump.port) : "");
    setAuthToken("");
  }, [sump]);

  return (
    <Dialog open={sump !== null} onClose={onClose} title={`Edit ${sump?.name ?? "Sump"}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ host, port: Number(port), authToken: authToken || undefined });
        }}
      >
        <label style={fieldStyle}>
          Host
          <input value={host} onChange={(e) => setHost(e.target.value)} required />
        </label>
        <label style={fieldStyle}>
          Port
          <input type="number" value={port} onChange={(e) => setPort(e.target.value)} required />
        </label>
        <label style={fieldStyle}>
          Auth token (leave blank to keep current)
          <input value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
        </label>
        <Button type="submit" variant="primary" disabled={pending}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </form>
    </Dialog>
  );
}
