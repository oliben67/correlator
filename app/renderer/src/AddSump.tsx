import { useEffect, useState } from "react";

// cor-CORE.PROVISION-006: the interactive "Add Sump" chooser, shown by
// App.tsx whenever the catalog has no live Sump. No CSS framework exists
// in this repo (no .css file, no <style> tag) -- plain inline styles only,
// matching the zero-styling convention already in place.

type DockerState =
  | { status: "checking" }
  | { status: "checked"; available: boolean }
  | { status: "error"; message: string };

type ExpandedOption = "connect" | "deploy" | null;

type ActionState = { phase: "idle" } | { phase: "pending" } | { phase: "error"; message: string };

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 4,
  marginBottom: 8,
  padding: 12,
};

const fieldStyle: React.CSSProperties = { display: "block", marginBottom: 8, width: "100%" };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function AddSump({ onSumpAdded }: { onSumpAdded: () => void }) {
  const [docker, setDocker] = useState<DockerState>({ status: "checking" });
  const [expanded, setExpanded] = useState<ExpandedOption>(null);
  const [action, setAction] = useState<ActionState>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    window.correlator
      .detectDocker()
      .then((available) => {
        if (!cancelled) setDocker({ status: "checked", available });
      })
      .catch((err: unknown) => {
        if (!cancelled) setDocker({ status: "error", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(option: ExpandedOption) {
    setAction({ phase: "idle" });
    setExpanded((current) => (current === option ? null : option));
  }

  const pending = action.phase === "pending";

  return (
    <div>
      <p>No sumps provisioned yet.</p>

      <div style={sectionStyle}>
        <button type="button" onClick={() => toggle("connect")}>
          Connect to an existing Sump
        </button>
        {expanded === "connect" && (
          <ConnectForm
            pending={pending}
            onSubmit={async (params) => {
              setAction({ phase: "pending" });
              try {
                await window.correlator.connectExistingSump(params);
                onSumpAdded();
              } catch (err) {
                setAction({ phase: "error", message: errorMessage(err) });
              }
            }}
          />
        )}
      </div>

      <div style={sectionStyle}>
        <button type="button" onClick={() => toggle("deploy")}>
          Deploy a new Sump
        </button>
        {expanded === "deploy" && (
          <DeploySection
            docker={docker}
            pending={pending}
            onInstallLocal={async () => {
              setAction({ phase: "pending" });
              try {
                await window.correlator.installLocalSump();
                onSumpAdded();
              } catch (err) {
                setAction({ phase: "error", message: errorMessage(err) });
              }
            }}
            onInstallRemote={async (params) => {
              setAction({ phase: "pending" });
              try {
                await window.correlator.installRemoteSump(params);
                onSumpAdded();
              } catch (err) {
                setAction({ phase: "error", message: errorMessage(err) });
              }
            }}
          />
        )}
      </div>

      {action.phase === "error" && <p role="alert">{action.message}</p>}
    </div>
  );
}

function ConnectForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (params: { name: string; host: string; port: number; authToken?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8765");
  const [authToken, setAuthToken] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          host,
          port: Number(port),
          authToken: authToken || undefined,
        });
      }}
    >
      <label style={fieldStyle}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label style={fieldStyle}>
        Host
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="127.0.0.1"
          required
        />
      </label>
      <label style={fieldStyle}>
        Port
        <input type="number" value={port} onChange={(e) => setPort(e.target.value)} required />
      </label>
      <label style={fieldStyle}>
        Auth token (optional)
        <input value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
      </label>
      <button type="submit" disabled={pending}>
        Connect
      </button>
    </form>
  );
}

function DeploySection({
  docker,
  pending,
  onInstallLocal,
  onInstallRemote,
}: {
  docker: DockerState;
  pending: boolean;
  onInstallLocal: () => void;
  onInstallRemote: (params: {
    name: string;
    sshTarget: string;
    sshKey?: string;
    sshPort?: number;
    remotePort: number;
    imageRef: string;
  }) => void;
}) {
  if (docker.status === "checking") {
    return <p>Checking for Docker…</p>;
  }
  if (docker.status === "error") {
    return <p role="alert">Couldn't check for Docker: {docker.message}</p>;
  }
  if (docker.available) {
    return (
      <div>
        <p>Docker is available — this Sump will be built and run locally.</p>
        <button type="button" disabled={pending} onClick={onInstallLocal}>
          Install locally
        </button>
      </div>
    );
  }
  return <RemoteDeployForm pending={pending} onSubmit={onInstallRemote} />;
}

function RemoteDeployForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (params: {
    name: string;
    sshTarget: string;
    sshKey?: string;
    sshPort?: number;
    remotePort: number;
    imageRef: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [sshTarget, setSshTarget] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [sshPort, setSshPort] = useState("");
  const [remotePort, setRemotePort] = useState("8765");
  const [imageRef, setImageRef] = useState("ghcr.io/oliben67/correlator-sump:latest");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          sshTarget,
          sshKey: sshKey || undefined,
          sshPort: sshPort ? Number(sshPort) : undefined,
          remotePort: Number(remotePort),
          imageRef,
        });
      }}
    >
      <p>Docker is not available locally — this Sump will be deployed to a remote host over SSH.</p>
      <label style={fieldStyle}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label style={fieldStyle}>
        SSH target
        <input
          value={sshTarget}
          onChange={(e) => setSshTarget(e.target.value)}
          placeholder="user@host"
          required
        />
      </label>
      <label style={fieldStyle}>
        SSH key path (optional)
        <input value={sshKey} onChange={(e) => setSshKey(e.target.value)} />
      </label>
      <label style={fieldStyle}>
        SSH port (optional)
        <input type="number" value={sshPort} onChange={(e) => setSshPort(e.target.value)} />
      </label>
      <label style={fieldStyle}>
        Remote port
        <input
          type="number"
          value={remotePort}
          onChange={(e) => setRemotePort(e.target.value)}
          required
        />
      </label>
      <label style={fieldStyle}>
        Image reference
        <input value={imageRef} onChange={(e) => setImageRef(e.target.value)} required />
      </label>
      <p style={{ color: "#a60" }}>
        Note: the default published image above isn't available yet — this option can't complete an
        install until it is. Point this at your own registry image if you have one.
      </p>
      <button type="submit" disabled={pending}>
        Deploy
      </button>
    </form>
  );
}
