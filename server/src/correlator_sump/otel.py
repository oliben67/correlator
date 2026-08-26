"""OpenTelemetry setup for the Sump server.

Implements cor-CORE.OTEL-001: traces spanning transport -> ingest ->
query, and metrics for stream depth / consumer lag. See REQ-000003
Requirement 2.
"""

from __future__ import annotations

from opentelemetry import metrics, trace
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import MetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter

SERVICE = "correlator-sump"


def configure_otel(
    span_exporter: SpanExporter | None = None,
    metric_reader: MetricReader | None = None,
) -> None:
    """Install the global tracer/meter providers. Pass an explicit
    `span_exporter`/`metric_reader` in tests (e.g. an in-memory exporter);
    production wiring passes the real OTLP exporter/reader instead."""
    resource = Resource.create({SERVICE_NAME: SERVICE})

    tracer_provider = TracerProvider(resource=resource)
    if span_exporter is not None:
        tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)

    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[metric_reader] if metric_reader is not None else [],
    )
    metrics.set_meter_provider(meter_provider)


def get_tracer() -> trace.Tracer:
    return trace.get_tracer(SERVICE)


def get_meter() -> metrics.Meter:
    return metrics.get_meter(SERVICE)


class SumpMetrics:
    """Stream-depth and consumer-lag metrics (REQ-000003 Requirement 2)."""

    def __init__(self, meter: metrics.Meter | None = None) -> None:
        meter = meter or get_meter()
        self.stream_depth = meter.create_up_down_counter(
            "sump.stream.depth",
            unit="{record}",
            description="Number of records currently queued for a stream.",
        )
        self.consumer_lag = meter.create_histogram(
            "sump.consumer.lag",
            unit="s",
            description="Time between a record's ingest and its consumption.",
        )
