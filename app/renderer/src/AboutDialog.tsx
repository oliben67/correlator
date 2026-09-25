import { useEffect, useState } from "react";
import type { AppVersionInfo } from "./correlator-api.js";

// RM-000030: was a static panel with a hardcoded "0.1.0" version literal
// -- now reads the real package.json version + runtime metadata via the
// new get-app-version IPC call. Stays a full Sidebar nav destination
// rather than becoming a modal: this app's navigation model treats
// About as its own page (unlike cttc's native OS dialog triggered from
// a menu), and changing that is a separate navigation decision this
// item doesn't need to make to deliver its real value -- real version
// metadata.

export function AboutDialog() {
  const [info, setInfo] = useState<AppVersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.correlator
      .getAppVersion()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {
        // Best effort -- the table below just shows "..." if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runtime = info
    ? [
        `Electron ${info.electron ?? "unknown"}`,
        `Node.js ${info.node}`,
        info.chrome ? `Chromium ${info.chrome}` : null,
      ]
        .filter(Boolean)
        .join(" / ")
    : "…";

  return (
    <div style={{ padding: "16px", maxWidth: "500px" }}>
      <h2>About Correlator</h2>
      <p style={{ fontSize: "1.1em", fontWeight: "500" }}>
        Multi-source Telemetry & Log Correlation Platform
      </p>

      <div
        style={{
          background: "var(--surface-2)",
          padding: "12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
        }}
      >
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9em" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>App Version:</td>
              <td style={{ padding: "4px 8px" }}>{info?.version ?? "…"}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Runtime:</td>
              <td style={{ padding: "4px 8px" }}>{runtime}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: "0.85em", color: "var(--text-secondary)", marginTop: "16px" }}>
        Licensed under LICENSE file terms.
      </p>
    </div>
  );
}
