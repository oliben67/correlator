import { useCallback, useEffect, useState } from "react";
import { DataStreamIcon } from "../icons.js";
import { Button } from "./Button.js";
import { Panel } from "./Panel.js";

// cor-CORE.UI-000006 (RM-000026): listDataSources/setDataSourcePrivacy
// were fully implemented in the IPC bridge with zero renderer call
// sites -- this is the first UI to actually use them.
//
// Real API constraint this works within: listDataSources only returns
// names (`{ data_sources: string[] }`), never each one's current
// privacy state -- setDataSourcePrivacy is the only call that reports a
// privacy value, and only for the one source it was just called for.
// So a freshly-listed source shows as "Public" (the honest "unknown,
// defaulting to the same public-until-marked-private state every new
// data stream actually starts in") until the user explicitly toggles
// it -- never a guessed "Private" a stale local cache might imply.

type PrivacyState = Record<string, boolean>;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function DataStreamPicker({ sumpId }: { sumpId: string }) {
  const [sources, setSources] = useState<string[] | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyState>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.correlator
      .listDataSources(sumpId)
      .then((result) => setSources(result.data_sources))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [sumpId]);

  useEffect(() => {
    setSources(null);
    setPrivacy({});
    refresh();
  }, [refresh]);

  async function togglePrivacy(name: string) {
    setPending(name);
    setError(null);
    try {
      const result = await window.correlator.setDataSourcePrivacy({
        sumpId,
        name,
        isPrivate: !privacy[name],
      });
      setPrivacy((current) => ({ ...current, [name]: result.is_private }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <DataStreamIcon size={18} />
          Data Streams
        </h3>
        <Button onClick={refresh}>Refresh</Button>
      </div>

      {error && <p role="alert">{error}</p>}

      {sources === null ? (
        <p>Loading data streams…</p>
      ) : sources.length === 0 ? (
        <p>No data streams reported by this Sump yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {sources.map((name) => (
            <li
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              <DataStreamIcon size={14} />
              <span style={{ flex: 1 }}>{name}</span>
              <Button
                variant={privacy[name] ? "primary" : "default"}
                disabled={pending === name}
                onClick={() => togglePrivacy(name)}
              >
                {privacy[name] ? "Private" : "Public"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
