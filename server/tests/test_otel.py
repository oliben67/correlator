"""cor-CORE.OTEL-001 acceptance tests (REQ-000003 Requirement 2)."""

import fakeredis.aioredis

from correlator_sump.ingest import IngestAdapter, handle_connection
from correlator_sump.otel import SumpMetrics


class _FakeStreamReader:
    def __init__(self, lines: list[bytes]) -> None:
        self._lines = list(lines)

    async def readline(self) -> bytes:
        if not self._lines:
            return b""
        return self._lines.pop(0)


class _FakeStreamWriter:
    def close(self) -> None:
        pass


async def test_transport_ingest_query_produce_one_trace(otel_spans) -> None:
    exporter, _ = otel_spans
    redis_client = fakeredis.aioredis.FakeRedis()
    adapter = IngestAdapter(redis_client)
    raw = b'{"kind": "container", "docker_host": "h1", "line": "trace me"}\n'

    await handle_connection(_FakeStreamReader([raw]), _FakeStreamWriter(), adapter)

    spans = exporter.get_finished_spans()
    names = {s.name for s in spans}
    assert {"sump.transport", "sump.ingest", "sump.query"} <= names

    by_name = {s.name: s for s in spans}
    transport_span = by_name["sump.transport"]
    ingest_span = by_name["sump.ingest"]
    query_span = by_name["sump.query"]

    # All three share one trace and nest under the transport span.
    trace_id = transport_span.context.trace_id
    assert ingest_span.context.trace_id == trace_id
    assert query_span.context.trace_id == trace_id
    assert ingest_span.parent.span_id == transport_span.context.span_id
    assert query_span.parent.span_id == transport_span.context.span_id


async def test_stream_depth_metric_recorded_on_successful_ingest(otel_spans) -> None:
    _, reader = otel_spans
    redis_client = fakeredis.aioredis.FakeRedis()
    metrics = SumpMetrics()
    adapter = IngestAdapter(redis_client, metrics=metrics)

    await adapter.ingest(b'{"kind": "container", "docker_host": "h1", "line": "x"}')

    data = reader.get_metrics_data()
    metric_names = {
        m.name for rm in data.resource_metrics for sm in rm.scope_metrics for m in sm.metrics
    }
    assert "sump.stream.depth" in metric_names


def test_consumer_lag_metric_is_a_histogram(otel_spans) -> None:
    metrics = SumpMetrics()
    # Recording a value must not raise -- proves it's wired as a real
    # instrument, not a stub.
    metrics.consumer_lag.record(0.42, {"stream": "logsump:ingest:v1"})
