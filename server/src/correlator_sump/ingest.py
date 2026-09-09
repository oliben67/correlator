"""Log ingestion pipeline: Fluent Bit's `tcp` output (raw_message_key) ->
this first-party adapter -> the Sump's Redis record store.

Implements cor-CORE.INGEST-001 per REQ-000003 Requirement 1's resolved
design: Fluent Bit forwards the untouched original record string over
TCP; this adapter validates it (parse as JSON, require `kind` and
`docker_host`, drop otherwise) and, only for a record that passes, issues
`RPUSH logsump:ingest:v1 <raw string>` -- byte-identical to what
`log-listener`'s ingest consumer already expects.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable
from typing import Any, Protocol

from correlator_sump.otel import SumpMetrics, get_tracer
from correlator_sump.query import query_latest

logger = logging.getLogger(__name__)

STREAM_KEY = "logsump:ingest:v1"
REQUIRED_FIELDS = ("kind", "docker_host")


class RedisLike(Protocol):
    def rpush(self, name: str, *values: bytes) -> Awaitable[Any]: ...
    def lrange(self, name: str, start: int, end: int) -> Awaitable[Any]: ...
    def xadd(self, name: str, fields: dict[Any, Any]) -> Awaitable[Any]: ...


QUERYABLE_KINDS = ("log", "metric")


def stream_key_for(record: dict) -> str | None:
    """`logsump:stream:{docker_host}:{kind}` for a record whose `kind` is
    queryable (`cor-CORE.QUERY-001`) -- `None` for anything else (no
    stream to fan out into, the flat-list write is still its home)."""
    if record["kind"] not in QUERYABLE_KINDS:
        return None
    return f"logsump:stream:{record['docker_host']}:{record['kind']}"


class StreamReaderLike(Protocol):
    async def readline(self) -> bytes: ...


class StreamWriterLike(Protocol):
    def close(self) -> Any: ...


def parse_record(raw: bytes) -> dict | None:
    """Parse `raw` as JSON and require every field in REQUIRED_FIELDS.
    Returns the parsed dict on success, `None` if it should be dropped
    (malformed JSON, not an object, or missing a required field) --
    matching today's validate-then-drop behavior."""
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None
    if any(field not in parsed for field in REQUIRED_FIELDS):
        return None
    return parsed


class IngestAdapter:
    """Validates and stores incoming records. One instance per Sump
    process; holds the Redis client and the OTel instruments it reports
    through."""

    def __init__(self, redis_client: RedisLike, metrics: SumpMetrics | None = None) -> None:
        self.redis = redis_client
        self._metrics = metrics
        self._tracer = get_tracer()

    async def ingest(self, raw: bytes) -> bool:
        """Process one raw record. Returns True if it was stored, False
        if it was dropped. Never raises for a malformed record -- dropping
        it is the correct, logged outcome, not a failure of this call."""
        with self._tracer.start_as_current_span("sump.ingest") as span:
            span.set_attribute("sump.ingest.raw_bytes", len(raw))
            record = parse_record(raw)
            if record is None:
                logger.warning("dropping invalid ingest record: %r", raw[:200])
                span.set_attribute("sump.ingest.dropped", True)
                return False
            await self.redis.rpush(STREAM_KEY, raw)
            span.set_attribute("sump.ingest.dropped", False)
            span.set_attribute("sump.ingest.kind", record["kind"])
            if self._metrics is not None:
                self._metrics.stream_depth.add(1, {"stream": STREAM_KEY})
            stream_key = stream_key_for(record)
            if stream_key is not None:
                # Additive fan-out for cor-CORE.QUERY-002's /records
                # endpoint -- the whole record as one JSON field, not
                # flattened into per-field stream entries, since several
                # fields (`fields`, `system`, `raw`) are themselves
                # nested objects Redis Streams' flat string-field model
                # can't represent directly.
                await self.redis.xadd(stream_key, {"json": raw})
                span.set_attribute("sump.ingest.stream_key", stream_key)
            return True


async def handle_connection(
    reader: StreamReaderLike, writer: StreamWriterLike, adapter: IngestAdapter
) -> None:
    """One Fluent Bit `tcp` output connection: newline-delimited raw
    records, one transport->ingest->query sequence per line (the query
    step is a read-after-write confirmation that the record actually
    landed -- this is also what closes the single trace spanning all
    three stages for cor-CORE.OTEL-001), connection held open until the
    sender closes it (matching a persistent Fluent Bit forwarder, not a
    one-shot request)."""
    tracer = get_tracer()
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            raw = line.rstrip(b"\n")
            with tracer.start_as_current_span("sump.transport") as span:
                span.set_attribute("sump.transport.kind", "fluent-bit-tcp")
                stored = await adapter.ingest(raw)
                if stored:
                    await query_latest(adapter.redis, STREAM_KEY, count=1)
    finally:
        writer.close()


async def run_ingest_server(
    adapter: IngestAdapter, host: str = "0.0.0.0", port: int = 5170
) -> asyncio.Server:
    """Start the TCP server Fluent Bit's `tcp` output (raw_message_key)
    connects to. Returns the running `asyncio.Server` -- caller owns its
    lifecycle (e.g. `async with server:`)."""
    return await asyncio.start_server(
        lambda r, w: handle_connection(r, w, adapter), host=host, port=port
    )
