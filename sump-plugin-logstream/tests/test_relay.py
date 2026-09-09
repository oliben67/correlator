"""cor-CORE.DATASTREAM-003 Requirement 3: `relay_once`/`run_relay_loop`."""

import asyncio
import json

import pytest

from sump_plugin_logstream.relay import Cursors, relay_once, run_relay_loop


class _FakeClient:
    def __init__(self, pages: list[dict]) -> None:
        self._pages = pages
        self.calls: list[dict] = []

    async def get_records(self, docker_host: str, **kwargs) -> dict:
        self.calls.append({"docker_host": docker_host, **kwargs})
        return self._pages.pop(0)


class _FakeAdapter:
    def __init__(self) -> None:
        self.ingested: list[bytes] = []

    async def ingest(self, raw: bytes) -> bool:
        self.ingested.append(raw)
        return True


async def test_relay_once_ingests_every_record_and_advances_cursors() -> None:
    client = _FakeClient(
        [
            {
                "records": [
                    {"kind": "log", "docker_host": "h1"},
                    {"kind": "metric", "docker_host": "h1"},
                ],
                "next_log_cursor": "log-2",
                "next_metric_cursor": "metric-2",
            }
        ]
    )
    adapter = _FakeAdapter()

    next_cursors = await relay_once(client, "h1", adapter, Cursors())

    assert len(adapter.ingested) == 2
    assert json.loads(adapter.ingested[0]) == {"kind": "log", "docker_host": "h1"}
    assert json.loads(adapter.ingested[1]) == {"kind": "metric", "docker_host": "h1"}
    assert next_cursors == Cursors(log_cursor="log-2", metric_cursor="metric-2")
    assert client.calls == [{"docker_host": "h1", "log_cursor": None, "metric_cursor": None}]


async def test_relay_once_with_zero_records_is_a_noop() -> None:
    client = _FakeClient([{"records": [], "next_log_cursor": None, "next_metric_cursor": None}])
    adapter = _FakeAdapter()

    next_cursors = await relay_once(client, "h1", adapter, Cursors())

    assert adapter.ingested == []
    assert next_cursors == Cursors()


async def test_relay_once_passes_current_cursors_to_the_next_fetch() -> None:
    client = _FakeClient([{"records": [], "next_log_cursor": None, "next_metric_cursor": None}])
    adapter = _FakeAdapter()

    await relay_once(client, "h1", adapter, Cursors(log_cursor="l5", metric_cursor="m5"))

    assert client.calls == [{"docker_host": "h1", "log_cursor": "l5", "metric_cursor": "m5"}]


async def test_run_relay_loop_survives_a_poll_failure_and_keeps_polling() -> None:
    class _FlakyClient:
        def __init__(self) -> None:
            self.call_count = 0

        async def get_records(self, docker_host: str, **kwargs) -> dict:
            self.call_count += 1
            if self.call_count == 1:
                raise RuntimeError("network blip")
            return {"records": [], "next_log_cursor": None, "next_metric_cursor": None}

    client = _FlakyClient()
    adapter = _FakeAdapter()

    task = asyncio.create_task(run_relay_loop(client, "h1", adapter, interval_s=0))
    for _ in range(50):
        await asyncio.sleep(0)
        if client.call_count >= 2:
            break
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert client.call_count >= 2


async def test_run_relay_loop_is_cancellable() -> None:
    client = _FakeClient(
        [{"records": [], "next_log_cursor": None, "next_metric_cursor": None}] * 1000
    )
    adapter = _FakeAdapter()

    task = asyncio.create_task(run_relay_loop(client, "h1", adapter, interval_s=3600))
    await asyncio.sleep(0)
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task
