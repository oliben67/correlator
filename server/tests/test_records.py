"""cor-CORE.QUERY-002 acceptance tests (REQ-000007 Requirement 2)."""

from datetime import UTC, datetime, timedelta

import fakeredis.aioredis
import httpx
import pytest

from correlator_sump.app import create_app
from correlator_sump.ingest import IngestAdapter
from correlator_sump.plugins import PluginManager
from correlator_sump.records import query_records

BASE = datetime(2026, 8, 14, 12, 0, 0, tzinfo=UTC)


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def _log(ts: datetime, **overrides) -> dict:
    record = {
        "kind": "log",
        "docker_host": "h1",
        "container_id": "c1",
        "ts": _iso(ts),
        "seq": 1,
        "level": "info",
        "message": "hello world",
    }
    record.update(overrides)
    return record


def _metric(ts: datetime, **overrides) -> dict:
    record = {
        "kind": "metric",
        "docker_host": "h1",
        "container_id": "c1",
        "ts": _iso(ts),
        "seq": 1,
        "cpu_pct": 0.5,
    }
    record.update(overrides)
    return record


@pytest.fixture
def redis_client():
    return fakeredis.aioredis.FakeRedis()


@pytest.fixture
def adapter(redis_client):
    return IngestAdapter(redis_client)


async def _ingest(adapter: IngestAdapter, record: dict) -> None:
    import json

    await adapter.ingest(json.dumps(record).encode())


async def test_start_end_boundaries_are_inclusive(redis_client, adapter) -> None:
    start = BASE
    end = BASE + timedelta(minutes=10)
    await _ingest(adapter, _log(start - timedelta(seconds=1)))  # just before -- excluded
    await _ingest(adapter, _log(start))  # exactly at start -- included
    await _ingest(adapter, _log(start + timedelta(minutes=5)))  # inside -- included
    await _ingest(adapter, _log(end))  # exactly at end -- included
    await _ingest(adapter, _log(end + timedelta(seconds=1)))  # just after -- excluded

    result = await query_records(redis_client, "h1", kind="log", start=start, end=end)

    assert [r["ts"] for r in result["records"]] == [
        _iso(start),
        _iso(start + timedelta(minutes=5)),
        _iso(end),
    ]


async def test_kind_filters_and_both_interleaves_by_ts(redis_client, adapter) -> None:
    await _ingest(adapter, _log(BASE))
    await _ingest(adapter, _metric(BASE + timedelta(seconds=1)))
    await _ingest(adapter, _log(BASE + timedelta(seconds=2)))

    only_log = await query_records(
        redis_client, "h1", kind="log", start=BASE, end=BASE + timedelta(minutes=1)
    )
    assert [r["kind"] for r in only_log["records"]] == ["log", "log"]

    only_metric = await query_records(
        redis_client, "h1", kind="metric", start=BASE, end=BASE + timedelta(minutes=1)
    )
    assert [r["kind"] for r in only_metric["records"]] == ["metric"]

    both = await query_records(
        redis_client, "h1", kind="both", start=BASE, end=BASE + timedelta(minutes=1)
    )
    assert [r["kind"] for r in both["records"]] == ["log", "metric", "log"]


async def test_container_level_and_q_post_filters(redis_client, adapter) -> None:
    await _ingest(adapter, _log(BASE, container_id="c1", level="info", message="hello world"))
    await _ingest(
        adapter, _log(BASE + timedelta(seconds=1), container_id="c2", level="error", message="boom")
    )
    await _ingest(
        adapter,
        _log(BASE + timedelta(seconds=2), container_id="c1", level="error", message="also boom"),
    )

    by_container = await query_records(
        redis_client,
        "h1",
        kind="log",
        container_id="c1",
        start=BASE,
        end=BASE + timedelta(minutes=1),
    )
    assert len(by_container["records"]) == 2

    by_level = await query_records(
        redis_client, "h1", kind="log", level="error", start=BASE, end=BASE + timedelta(minutes=1)
    )
    assert len(by_level["records"]) == 2
    assert all(r["level"] == "error" for r in by_level["records"])

    by_q = await query_records(
        redis_client, "h1", kind="log", q="BOOM", start=BASE, end=BASE + timedelta(minutes=1)
    )
    assert len(by_q["records"]) == 2
    assert all("boom" in r["message"] for r in by_q["records"])

    combined = await query_records(
        redis_client,
        "h1",
        kind="log",
        container_id="c1",
        level="error",
        start=BASE,
        end=BASE + timedelta(minutes=1),
    )
    assert len(combined["records"]) == 1
    assert combined["records"][0]["message"] == "also boom"


async def test_pagination_resumes_with_no_gap_or_duplicate(redis_client, adapter) -> None:
    for i in range(5):
        await _ingest(adapter, _log(BASE + timedelta(seconds=i)))

    first = await query_records(
        redis_client, "h1", kind="log", start=BASE, end=BASE + timedelta(minutes=1), limit=2
    )
    assert len(first["records"]) == 2
    assert first["next_log_cursor"] is not None

    second = await query_records(
        redis_client,
        "h1",
        kind="log",
        start=BASE,
        end=BASE + timedelta(minutes=1),
        limit=2,
        log_cursor=first["next_log_cursor"],
    )
    assert len(second["records"]) == 2
    assert second["next_log_cursor"] is not None

    third = await query_records(
        redis_client,
        "h1",
        kind="log",
        start=BASE,
        end=BASE + timedelta(minutes=1),
        limit=2,
        log_cursor=second["next_log_cursor"],
    )
    assert len(third["records"]) == 1
    assert third["next_log_cursor"] is None

    all_ts = [r["ts"] for r in first["records"] + second["records"] + third["records"]]
    assert all_ts == sorted(set(all_ts))
    assert len(all_ts) == 5


async def test_records_endpoint_wired_end_to_end() -> None:
    redis_client = fakeredis.aioredis.FakeRedis()
    app = create_app(
        redis_client=redis_client, plugin_manager=PluginManager(disabled=["ssh"]), ingest_port=0
    )
    adapter = app.state.adapter

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with app.router.lifespan_context(app):
            await _ingest(adapter, _log(BASE))
            response = await client.get(
                "/records",
                params={
                    "docker_host": "h1",
                    "start": _iso(BASE - timedelta(minutes=1)),
                    "end": _iso(BASE + timedelta(minutes=1)),
                },
            )

    assert response.status_code == 200
    body = response.json()
    assert len(body["records"]) == 1
    assert body["records"][0]["message"] == "hello world"
