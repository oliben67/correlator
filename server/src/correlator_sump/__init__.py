"""correlator's Sump server: telemetry/log correlation, container-native.

Phase 1 of the port roadmap (docs/roadmap/cttc-to-correlator-port.md):
the Fluent Bit -> adapter ingestion pipeline (`ingest`), OpenTelemetry
instrumentation (`otel`), a minimal read-back query layer (`query`), and
the pytest/pluggy-style plugin manager (`plugins`), wired into one
FastAPI app (`app`). No plugins registered yet -- the first one (SSH)
ships in Phase 3.
"""

__version__ = "0.2.0"
