"""cor-CORE.DATASTREAM-003 Requirement 2: `LogSumpClient`."""

import httpx
import pytest

from sump_plugin_logstream.client import LogSumpClient


def _client(handler) -> LogSumpClient:
    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="http://logsump.example", headers={"X-API-Key": "secret"}, transport=transport
    )
    return LogSumpClient(http_client)


async def test_get_catalog_returns_parsed_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/catalog"
        assert request.headers["x-api-key"] == "secret"
        return httpx.Response(200, json=[{"id": "d1", "host": "h1", "enabled": True}])

    client = _client(handler)
    catalog = await client.get_catalog()

    assert catalog == [{"id": "d1", "host": "h1", "enabled": True}]


async def test_get_records_sends_expected_query_params() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["params"] = dict(request.url.params)
        return httpx.Response(200, json={"records": [], "next_log_cursor": None})

    client = _client(handler)
    await client.get_records(
        "h1",
        kind="log",
        log_cursor="c1",
        metric_cursor="c2",
        limit=50,
        start="2026-01-01T00:00:00Z",
    )

    assert captured["params"] == {
        "docker_host": "h1",
        "kind": "log",
        "start": "2026-01-01T00:00:00Z",
        "log_cursor": "c1",
        "metric_cursor": "c2",
        "limit": "50",
    }


async def test_get_records_returns_parsed_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"records": [{"kind": "log"}], "next_log_cursor": "abc"})

    client = _client(handler)
    page = await client.get_records("h1")

    assert page == {"records": [{"kind": "log"}], "next_log_cursor": "abc"}


async def test_non_2xx_response_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "invalid API key"})

    client = _client(handler)

    with pytest.raises(httpx.HTTPStatusError):
        await client.get_catalog()
