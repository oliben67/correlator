"""End-to-end smoke test for the wired-up Phase 1 app."""

import fakeredis.aioredis
import httpx

from correlator_sump.app import create_app
from correlator_sump.plugins import PluginManager


async def test_health_reports_ok_and_loaded_plugins() -> None:
    # An explicit, empty PluginManager -- this test is about the /health
    # endpoint's shape, not about which plugins happen to be installed in
    # this dev environment (sump-plugin-ssh is a dev dependency here, for
    # test_integration_ssh_plugin.py's own purposes).
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=PluginManager(disabled=["ssh"]),
        ingest_port=0,
    )

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with _lifespan(app):
            response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "plugins": []}


async def test_query_endpoint_returns_ingested_records() -> None:
    redis_client = fakeredis.aioredis.FakeRedis()
    app = create_app(redis_client=redis_client, ingest_port=0)
    adapter = app.state.adapter

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with _lifespan(app):
            await adapter.ingest(b'{"kind": "container", "docker_host": "h1", "line": "hi"}')
            response = await client.get("/query/logsump:ingest:v1")

    assert response.status_code == 200
    body = response.json()
    assert body["records"] == ['{"kind": "container", "docker_host": "h1", "line": "hi"}']


def _lifespan(app):
    """Runs the app's own lifespan context manager directly, since
    `httpx.ASGITransport` doesn't trigger FastAPI's lifespan events."""
    return app.router.lifespan_context(app)
