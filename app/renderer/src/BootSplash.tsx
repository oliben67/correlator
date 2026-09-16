export function BootSplash({ status }: { status?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#1e1e1e",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: "2.5em", marginBottom: "8px" }}>Correlator</h1>
      <p style={{ color: "#aaa", marginBottom: "24px" }}>
        Initializing Telemetry & Correlation Shell...
      </p>
      <div style={{ fontSize: "0.9em", color: "#007acc" }}>
        {status ?? "Loading catalog and Sump connections..."}
      </div>
    </div>
  );
}
