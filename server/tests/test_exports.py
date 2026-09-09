"""cor-CORE.ARCHIVE-002 acceptance tests (REQ-000008 Requirement 2)."""

import json
from datetime import UTC, datetime, timedelta

import fakeredis.aioredis
import httpx
import pytest

from correlator_sump.app import create_app
from correlator_sump.archive import read_recording, read_track
from correlator_sump.plugins import PluginManager

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
def app_and_adapter():
    redis_client = fakeredis.aioredis.FakeRedis()
    app = create_app(
        redis_client=redis_client, plugin_manager=PluginManager(disabled=["ssh"]), ingest_port=0
    )
    return app, app.state.adapter


async def _ingest(adapter, record: dict) -> None:
    await adapter.ingest(json.dumps(record).encode())


async def test_recordings_export_matches_records_endpoint_content(app_and_adapter) -> None:
    app, adapter = app_and_adapter
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with app.router.lifespan_context(app):
            await _ingest(adapter, _log(BASE, container_id="c1", message="line one"))
            await _ingest(
                adapter, _log(BASE + timedelta(seconds=1), container_id="c2", message="line two")
            )

            records_response = await client.get(
                "/records",
                params={
                    "docker_host": "h1",
                    "kind": "log",
                    "start": _iso(BASE - timedelta(minutes=1)),
                    "end": _iso(BASE + timedelta(minutes=1)),
                },
            )
            export_response = await client.get(
                "/recordings/export",
                params={
                    "docker_host": "h1",
                    "start": _iso(BASE - timedelta(minutes=1)),
                    "end": _iso(BASE + timedelta(minutes=1)),
                },
            )

    assert export_response.status_code == 200
    assert export_response.headers["content-type"] == "application/zip"

    expected_messages = {r["message"] for r in records_response.json()["records"]}
    archive = read_recording(export_response.content)
    archived_messages = {row.text for rows in archive.sources.values() for row in rows}
    assert archived_messages == expected_messages
    assert set(archive.sources.keys()) == {"c1", "c2"}


async def test_tracks_export_extracts_the_requested_metric_field(app_and_adapter) -> None:
    app, adapter = app_and_adapter
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with app.router.lifespan_context(app):
            await _ingest(adapter, _metric(BASE, cpu_pct=0.3, mem_pct=0.6))
            await _ingest(adapter, _metric(BASE + timedelta(seconds=1), cpu_pct=0.4, mem_pct=0.7))

            response = await client.get(
                "/tracks/export",
                params={
                    "docker_host": "h1",
                    "metric": "cpu_pct",
                    "container_id": "c1",
                    "start": _iso(BASE - timedelta(minutes=1)),
                    "end": _iso(BASE + timedelta(minutes=1)),
                },
            )

    assert response.status_code == 200
    archive = read_track(response.content)
    assert archive.series_name == "cpu_pct"
    assert sorted(v for _ts, v in archive.points) == [0.3, 0.4]


async def test_tracks_export_rejects_an_unknown_metric_field(app_and_adapter) -> None:
    app, _adapter = app_and_adapter
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with app.router.lifespan_context(app):
            response = await client.get(
                "/tracks/export",
                params={"docker_host": "h1", "metric": "not_a_real_field"},
            )

    assert response.status_code == 422
