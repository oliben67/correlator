export function BootSplash({ status }: { status?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--page)",
        color: "var(--text-primary)",
      }}
    >
      <h1 style={{ fontSize: "2.5em", marginBottom: "8px" }}>Correlator</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
        Initializing Telemetry & Correlation Shell...
      </p>
      <div style={{ fontSize: "0.9em", color: "var(--accent)" }}>
        {status ?? "Loading catalog and Sump connections..."}
      </div>
    </div>
  );
}
