"""End-to-end smoke test for the wired-up Phase 1 app."""

import asyncio

import fakeredis.aioredis
import httpx

from correlator_sump.app import create_app
from correlator_sump.plugins import PluginManager, hookimpl


async def test_health_reports_ok_and_loaded_plugins() -> None:
    # An explicit, empty PluginManager -- this test is about the /health
    # endpoint's shape, not about which plugins happen to be installed in
    # this dev environment (sump-plugin-ssh/sump-plugin-logstream are dev
    # dependencies here, for their own integration tests' purposes).
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=PluginManager(disabled=["ssh", "logstream"]),
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


class _RelayPlugin:
    """A minimal cor-CORE.DATASTREAM-003-shaped plugin: registers one
    long-lived background task that runs until cancelled, tracking
    start/cancel so the test can assert on lifespan's own bracket."""

    def __init__(self) -> None:
        self.started = False
        self.cancelled = False

    @hookimpl
    def register_background_task(self, manager: PluginManager) -> None:
        manager.add_background_task("relay", self._run)

    async def _run(self) -> None:
        self.started = True
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            self.cancelled = True
            raise


async def test_lifespan_starts_and_cancels_background_tasks() -> None:
    relay_plugin = _RelayPlugin()
    manager = PluginManager(disabled=["ssh"])
    manager.register(relay_plugin, name="relay-plugin")
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=manager,
        ingest_port=0,
    )

    async with _lifespan(app):
        # Yield control so the scheduled task actually runs its first line.
        await asyncio.sleep(0)
        assert relay_plugin.started

    assert relay_plugin.cancelled
