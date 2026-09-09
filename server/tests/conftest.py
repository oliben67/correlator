"""Shared fixtures. OpenTelemetry's global TracerProvider/MeterProvider
can only be set once per process (the SDK silently ignores later calls),
so tests configure them exactly once, session-scoped, with in-memory
exporters -- individual tests clear the exporter/reader beforehand and
only assert on what they themselves produced."""

import pytest
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from correlator_sump.otel import configure_otel


@pytest.fixture(scope="session")
def otel_test_exporters():
    exporter = InMemorySpanExporter()
    reader = InMemoryMetricReader()
    configure_otel(span_exporter=exporter, metric_reader=reader)
    return exporter, reader


@pytest.fixture
def otel_spans(otel_test_exporters):
    exporter, reader = otel_test_exporters
    exporter.clear()
    yield exporter, reader


def lifespan(app):
    """Runs the app's own lifespan context manager directly, since
    `httpx.ASGITransport` doesn't trigger FastAPI's lifespan events."""
    return app.router.lifespan_context(app)
