"""FastAPI app tying the ingestion adapter, query layer, and plugin
manager together into one Sump process (REQ-000003, Phase 1 skeleton)."""

from __future__ import annotations

from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI

from correlator_sump.ingest import STREAM_KEY, IngestAdapter, run_ingest_server
from correlator_sump.otel import SumpMetrics
from correlator_sump.plugins import PluginManager
from correlator_sump.query import query_latest


def create_app(
    redis_client: redis.Redis | None = None,
    plugin_manager: PluginManager | None = None,
    ingest_port: int = 5170,
) -> FastAPI:
    redis_client = redis_client or redis.Redis()
    plugin_manager = plugin_manager or PluginManager()
    adapter = IngestAdapter(redis_client, metrics=SumpMetrics())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await plugin_manager.discover()
        server = await run_ingest_server(adapter, port=ingest_port)
        async with server:
            yield
        server.close()
        await server.wait_closed()

    app = FastAPI(title="correlator-sump", lifespan=lifespan)
    app.state.plugin_manager = plugin_manager
    app.state.adapter = adapter

    @app.get("/health")
    async def health() -> dict[str, bool | list[str]]:
        return {"ok": True, "plugins": plugin_manager.loaded_plugin_names}

    @app.get("/query/{stream}")
    async def query(stream: str, count: int = 20) -> dict[str, list[str]]:
        records = await query_latest(redis_client, stream, count=count)
        return {"records": [r.decode("utf-8", errors="replace") for r in records]}

    plugin_manager.hook.contribute_routes(app=app)

    return app


__all__ = ["create_app", "STREAM_KEY"]
