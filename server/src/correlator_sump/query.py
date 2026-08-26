"""Minimal read-back query over the Sump's Redis record store.

Phase 1 scope only: confirming a record landed (used as the ingestion
path's own read-after-write check, closing the transport -> ingest ->
query trace for cor-CORE.OTEL-001) and a small FastAPI-facing query for
manual inspection. The real query layer (filtering, pagination, the
`.correlator/` catalog) is Phase 2+ scope.
"""

from __future__ import annotations

from collections.abc import Awaitable
from typing import Any, Protocol

from correlator_sump.otel import get_tracer


class RedisLike(Protocol):
    def lrange(self, name: str, start: int, end: int) -> Awaitable[Any]: ...


async def query_latest(redis_client: RedisLike, stream_key: str, count: int = 1) -> list[bytes]:
    """Return the `count` most recently RPUSH-ed records for `stream_key`,
    oldest of the batch first. Empty list if the stream has nothing yet."""
    tracer = get_tracer()
    with tracer.start_as_current_span("sump.query") as span:
        span.set_attribute("sump.query.stream", stream_key)
        span.set_attribute("sump.query.count", count)
        records = await redis_client.lrange(stream_key, -count, -1)
        span.set_attribute("sump.query.result_count", len(records))
        return records
