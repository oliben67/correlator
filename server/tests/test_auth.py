"""cor-CORE.FEDERATION-001: Sump request authentication + user identity."""

import fakeredis.aioredis
import httpx

from correlator_sump.app import create_app
from correlator_sump.auth import get_user_id
from correlator_sump.plugins import PluginManager
from tests.conftest import lifespan


async def test_unset_token_leaves_every_route_open() -> None:
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=PluginManager(disabled=["ssh", "logstream"]),
        ingest_port=0,
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.get("/query/x")
    assert response.status_code == 200


async def test_configured_token_rejects_missing_or_wrong_header() -> None:
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=PluginManager(disabled=["ssh", "logstream"]),
        ingest_port=0,
        api_token="secret-token",
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            missing = await client.get("/query/x")
            wrong = await client.get("/query/x", headers={"X-Correlator-Token": "nope"})
            right = await client.get("/query/x", headers={"X-Correlator-Token": "secret-token"})
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert right.status_code == 200


async def test_configured_token_leaves_health_open() -> None:
    app = create_app(
        redis_client=fakeredis.aioredis.FakeRedis(),
        plugin_manager=PluginManager(disabled=["ssh", "logstream"]),
        ingest_port=0,
        api_token="secret-token",
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with lifespan(app):
            response = await client.get("/health")
    assert response.status_code == 200


def test_get_user_id_reads_header_or_none() -> None:
    assert get_user_id("abc-123") == "abc-123"
    assert get_user_id(None) is None
    assert get_user_id("") is None
