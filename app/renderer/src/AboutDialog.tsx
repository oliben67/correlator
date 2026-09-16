export function AboutDialog() {
  return (
    <div style={{ padding: "16px", maxWidth: "500px" }}>
      <h2>About Correlator</h2>
      <p style={{ fontSize: "1.1em", fontWeight: "500" }}>
        Multi-source Telemetry & Log Correlation Platform
      </p>

      <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "4px", border: "1px solid #ddd" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9em" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>App Version:</td>
              <td style={{ padding: "4px 8px" }}>0.1.0</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Catalyst Framework:</td>
              <td style={{ padding: "4px 8px" }}>0.27.0</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Signed Signer:</td>
              <td style={{ padding: "4px 8px" }}>olivier-steck (z6qEx1Kf)</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Runtime:</td>
              <td style={{ padding: "4px 8px" }}>Electron / Node.js / React</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: "0.85em", color: "#666", marginTop: "16px" }}>
        Licensed under LICENSE file terms. Built on top of the Catalyst Specification.
      </p>
    </div>
  );
}
