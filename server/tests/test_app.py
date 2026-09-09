"""End-to-end smoke test for the wired-up Phase 1 app."""

import asyncio
from collections.abc import Sequence

import fakeredis.aioredis
import httpx
import pytest
from fastapi import FastAPI

from correlator_sump.app import create_app
from correlator_sump.datasource import ContainerRef
from correlator_sump.plugins import PluginManager, hookimpl
from correlator_sump.transport import ExecResult, Transport
from tests.conftest import lifespan


def test_create_app_reads_redis_url_env_var_when_no_client_given(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """cor-CORE.PACKAGING-001: docker-compose.yml's redis service is
    reachable by name, not localhost -- REDIS_URL must actually be
    consulted, not just documented."""
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")

    app = create_app(plugin_manager=PluginManager(disabled=["ssh", "logstream"]), ingest_port=0)

    assert app.state.adapter.redis.connection_pool.connection_kwargs["host"] == "redis"


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
        async with lifespan(app):
            response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "plugins": []}


async def test_query_endpoint_returns_ingested_records() -> None:
    redis_client = fakeredis.aioredis.FakeRedis()
    app = create_app(redis_client=redis_client, ingest_port=0)
    adapter = app.state.adapter

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            await adapter.ingest(b'{"kind": "container", "docker_host": "h1", "line": "hi"}')
            response = await client.get("/query/logsump:ingest:v1")

    assert response.status_code == 200
    body = response.json()
    assert body["records"] == ['{"kind": "container", "docker_host": "h1", "line": "hi"}']


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

    async with lifespan(app):
        # Yield control so the scheduled task actually runs its first line.
        await asyncio.sleep(0)
        assert relay_plugin.started

    assert relay_plugin.cancelled


class _FakeExecTransport(Transport):
    """A minimal real `Transport` -- only `run` is exercised by these
    tests, but subclassing (rather than duck-typing) is what lets a
    fake satisfy `DataSource.transport`'s nominal `Transport | None`
    typing."""

    def _shell_command(self, script: str) -> list[str]:
        raise NotImplementedError

    async def run(self, args: Sequence[str]) -> ExecResult:
        return ExecResult(returncode=0, stdout="", stderr="")

    def stream_lines(self, args: Sequence[str]):
        raise NotImplementedError


class _FakeDataSource:
    def __init__(self, name: str, transport: Transport | None) -> None:
        self._name = name
        self._transport = transport

    @property
    def name(self) -> str:
        return self._name

    @property
    def transport(self) -> Transport | None:
        return self._transport

    async def list_targets(self) -> list[ContainerRef]:
        return []


def _app_with_data_sources(**sources: Transport | None) -> tuple[FastAPI, PluginManager]:
    manager = PluginManager(disabled=["ssh", "logstream"])
    for name, transport in sources.items():
        manager.add_data_source(name, _FakeDataSource(name, transport))
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(), plugin_manager=manager, ingest_port=0
    )
    return app, manager


async def test_data_sources_lists_every_registered_source_with_no_privacy_set() -> None:
    app, _ = _app_with_data_sources(self=_FakeExecTransport(), remote=_FakeExecTransport())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.get("/data-sources")
    assert response.status_code == 200
    assert sorted(response.json()["data_sources"]) == ["remote", "self"]


async def test_data_sources_hides_private_source_from_a_different_user() -> None:
    app, _ = _app_with_data_sources(self=_FakeExecTransport())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            await client.put(
                "/data-sources/self/privacy",
                json={"is_private": True},
                headers={"X-Correlator-User-Id": "user-a"},
            )
            as_owner = await client.get("/data-sources", headers={"X-Correlator-User-Id": "user-a"})
            as_other = await client.get("/data-sources", headers={"X-Correlator-User-Id": "user-b"})
            anonymous = await client.get("/data-sources")

    assert as_owner.json()["data_sources"] == ["self"]
    assert as_other.json()["data_sources"] == []
    assert anonymous.json()["data_sources"] == []


async def test_privacy_update_by_non_owner_is_rejected() -> None:
    app, _ = _app_with_data_sources(self=_FakeExecTransport())
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            await client.put(
                "/data-sources/self/privacy",
                json={"is_private": True},
                headers={"X-Correlator-User-Id": "user-a"},
            )
            response = await client.put(
                "/data-sources/self/privacy",
                json={"is_private": False},
                headers={"X-Correlator-User-Id": "user-b"},
            )
    assert response.status_code == 403


async def test_privacy_update_for_unknown_source_is_404() -> None:
    app, _ = _app_with_data_sources()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.put(
                "/data-sources/ghost/privacy",
                json={"is_private": True},
                headers={"X-Correlator-User-Id": "user-a"},
            )
    assert response.status_code == 404


async def test_promote_unknown_data_source_is_404() -> None:
    app, _ = _app_with_data_sources()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.post(
                "/promote", json={"name": "ghost", "host": "h", "image_ref": "img"}
            )
    assert response.status_code == 404


async def test_promote_source_with_no_transport_is_422() -> None:
    app, _ = _app_with_data_sources(logstream_source=None)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.post(
                "/promote",
                json={"name": "logstream_source", "host": "h", "image_ref": "img"},
            )
    assert response.status_code == 422


async def test_mesh_ownership_claim_then_peers_sync_roundtrip() -> None:
    app, _ = _app_with_data_sources()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            claim = await client.post(
                "/mesh/ownership/claim", json={"ownerLabel": "alice", "ownerPublicKey": "key-a"}
            )
            second_claim = await client.post(
                "/mesh/ownership/claim", json={"ownerLabel": "bob", "ownerPublicKey": "key-b"}
            )
            sync = await client.post(
                "/mesh/peers/sync",
                json={"peers": {"10.0.0.1:8080": {"host": "10.0.0.1", "port": 8080}}},
            )
            peers = await client.get("/mesh/peers")

    assert claim.json() == {"claimed": True}
    assert second_claim.json() == {"claimed": False}
    assert sync.json()["peers"]["10.0.0.1:8080"]["existence"] == "unknown"
    assert peers.json()["peers"] == sync.json()["peers"]
