"""cor-CORE.INGEST-001 acceptance tests (REQ-000003 Requirement 1)."""

import asyncio

import fakeredis.aioredis
import pytest

from correlator_sump.ingest import STREAM_KEY, IngestAdapter, parse_record, run_ingest_server


@pytest.fixture
def redis_client():
    return fakeredis.aioredis.FakeRedis()


def test_parse_record_accepts_well_formed_record() -> None:
    raw = b'{"kind": "container", "docker_host": "h1", "line": "hello"}'
    assert parse_record(raw) == {"kind": "container", "docker_host": "h1", "line": "hello"}


def test_parse_record_drops_malformed_json() -> None:
    assert parse_record(b"not json at all") is None


def test_parse_record_drops_missing_required_fields() -> None:
    assert parse_record(b'{"kind": "container"}') is None
    assert parse_record(b'{"docker_host": "h1"}') is None
    assert parse_record(b"{}") is None


def test_parse_record_drops_non_object_json() -> None:
    assert parse_record(b"[1, 2, 3]") is None
    assert parse_record(b'"just a string"') is None


async def test_valid_record_is_retrievable_byte_identical(redis_client) -> None:
    adapter = IngestAdapter(redis_client)
    raw = b'{"kind": "container", "docker_host": "h1", "line": "hello world"}'

    stored = await adapter.ingest(raw)

    assert stored is True
    result = await redis_client.lrange(STREAM_KEY, 0, -1)
    assert result == [raw]


async def test_no_silent_drop_under_normal_operation(redis_client) -> None:
    adapter = IngestAdapter(redis_client)
    records = [
        f'{{"kind": "container", "docker_host": "h{i}", "line": "l{i}"}}'.encode()
        for i in range(20)
    ]

    results = [await adapter.ingest(r) for r in records]

    assert all(results)
    stored = await redis_client.lrange(STREAM_KEY, 0, -1)
    assert stored == records


async def test_malformed_record_dropped_before_reaching_store(redis_client) -> None:
    adapter = IngestAdapter(redis_client)

    stored = await adapter.ingest(b"{not valid json")

    assert stored is False
    assert await redis_client.lrange(STREAM_KEY, 0, -1) == []


async def test_tcp_wire_path_end_to_end(redis_client) -> None:
    """Exercises the full Fluent Bit `tcp` output -> adapter -> Redis
    path over a real socket, standing in for Fluent Bit itself."""
    adapter = IngestAdapter(redis_client)
    server = await run_ingest_server(adapter, host="127.0.0.1", port=0)
    port = server.sockets[0].getsockname()[1]

    async with server:
        reader, writer = await asyncio.open_connection("127.0.0.1", port)
        raw = b'{"kind": "container", "docker_host": "h1", "line": "wire test"}'
        writer.write(raw + b"\n")
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        await asyncio.sleep(0.05)  # let the server-side task process it

    stored = await redis_client.lrange(STREAM_KEY, 0, -1)
    assert stored == [raw]
