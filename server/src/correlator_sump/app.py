"""FastAPI app tying the ingestion adapter, query layer, and plugin
manager together into one Sump process (REQ-000003, Phase 1 skeleton)."""

from __future__ import annotations

import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import redis.asyncio as redis
from fastapi import Depends, FastAPI, HTTPException, Response

from correlator_sump import mesh
from correlator_sump.auth import get_user_id, require_token
from correlator_sump.exports import (
    VALID_METRIC_FIELDS,
    build_recording_archive,
    build_track_archive,
)
from correlator_sump.federation import (
    OwnershipConflictError,
    get_privacy,
    set_privacy,
    visible_data_sources,
)
from correlator_sump.ingest import STREAM_KEY, IngestAdapter, run_ingest_server
from correlator_sump.otel import SumpMetrics
from correlator_sump.plugins import BackgroundTaskFactory, PluginManager, validate_plugin_routes
from correlator_sump.promotion import PromotionParams, promote_data_stream
from correlator_sump.query import query_latest
from correlator_sump.records import DEFAULT_LIMIT, query_records

_AUTH = [Depends(require_token)]
logger = logging.getLogger("correlator_sump.app")


async def _run_isolated_background_task(name: str, factory: BackgroundTaskFactory) -> None:
    """Run a plugin background task in an exception-isolated wrapper
    (cor-CORE.PLUGIN-002). Prevents unhandled exceptions from crashing the
    server process or cancelling sibling tasks."""
    try:
        await factory()
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.error(
            "Background task '%s' raised an unhandled exception: %s",
            name,
            exc,
            exc_info=True,
        )


def create_app(
    redis_client: redis.Redis | None = None,
    plugin_manager: PluginManager | None = None,
    ingest_port: int = 5170,
    api_token: str | None = None,
) -> FastAPI:
    # cor-CORE.PACKAGING-001: docker-compose.yml runs redis as a separate
    # service (reachable by its service name, not localhost) -- REDIS_URL
    # lets that compose file point here without redis.Redis()'s bare
    # localhost default silently failing to connect.
    redis_client = redis_client or (
        redis.Redis.from_url(redis_url)
        if (redis_url := os.environ.get("REDIS_URL"))
        else redis.Redis()
    )
    plugin_manager = plugin_manager or PluginManager()
    adapter = IngestAdapter(redis_client, metrics=SumpMetrics())
    plugin_manager.ingest_adapter = adapter
    #: `cor-CORE.FEDERATION-001` -- unset means no gate, matching
    #: `provisionLocal`/`provisionRemote`'s own `CORRELATOR_API_TOKEN`
    #: env var (already injected at install time since Phase 2).
    resolved_api_token = (
        api_token if api_token is not None else os.environ.get("CORRELATOR_API_TOKEN")
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await plugin_manager.discover()
        server = await run_ingest_server(adapter, port=ingest_port)
        background_tasks = [
            asyncio.create_task(
                _run_isolated_background_task(name, factory), name=name
            )
            for name, factory in plugin_manager.background_task_factories.items()
        ]
        async with server:
            yield
        server.close()
        await server.wait_closed()
        for task in background_tasks:
            task.cancel()
        for task in background_tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass

    app = FastAPI(title="correlator-sump", lifespan=lifespan)
    app.state.plugin_manager = plugin_manager
    app.state.adapter = adapter
    app.state.api_token = resolved_api_token

    @app.get("/health")
    async def health() -> dict[str, bool | list[str]]:
        return {"ok": True, "plugins": plugin_manager.loaded_plugin_names}

    @app.get("/query/{stream}", dependencies=_AUTH)
    async def query(stream: str, count: int = 20) -> dict[str, list[str]]:
        records = await query_latest(redis_client, stream, count=count)
        return {"records": [r.decode("utf-8", errors="replace") for r in records]}

    @app.get("/records", dependencies=_AUTH)
    async def records(
        docker_host: str,
        kind: str = "both",
        container_id: str | None = None,
        level: str | None = None,
        q: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        log_cursor: str | None = None,
        metric_cursor: str | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> dict:
        return await query_records(
            redis_client,
            docker_host,
            kind=kind,
            container_id=container_id,
            level=level,
            q=q,
            start=start,
            end=end,
            log_cursor=log_cursor,
            metric_cursor=metric_cursor,
            limit=limit,
        )

    async def _fetch_all(
        kind: str, docker_host: str, start: datetime, end: datetime, **filters
    ) -> list[dict]:
        """Loops `query_records`' pagination until exhausted -- an
        export needs every matching record, not just one page."""
        all_records: list[dict] = []
        is_log = kind == "log"
        cursor: str | None = None
        while True:
            page = await query_records(
                redis_client,
                docker_host,
                kind=kind,
                start=start,
                end=end,
                log_cursor=cursor if is_log else None,
                metric_cursor=cursor if not is_log else None,
                **filters,
            )
            all_records.extend(page["records"])
            next_cursor = page["next_log_cursor"] if is_log else page["next_metric_cursor"]
            if next_cursor is None:
                return all_records
            cursor = next_cursor

    @app.get("/recordings/export", dependencies=_AUTH)
    async def recordings_export(
        docker_host: str,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> Response:
        now = datetime.now(UTC)
        resolved_start = start or (now - timedelta(hours=1))
        resolved_end = end or now
        all_records = await _fetch_all("log", docker_host, resolved_start, resolved_end)
        data = build_recording_archive(all_records, resolved_start, resolved_end)
        return Response(
            content=data,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{docker_host}.recording"'},
        )

    @app.get("/tracks/export", dependencies=_AUTH)
    async def tracks_export(
        docker_host: str,
        metric: str,
        container_id: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> Response:
        if metric not in VALID_METRIC_FIELDS:
            raise HTTPException(status_code=422, detail=f"unknown metric field: {metric!r}")
        now = datetime.now(UTC)
        resolved_start = start or (now - timedelta(hours=1))
        resolved_end = end or now
        all_records = await _fetch_all(
            "metric", docker_host, resolved_start, resolved_end, container_id=container_id
        )
        data = build_track_archive(all_records, metric, resolved_start, resolved_end)
        return Response(
            content=data,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{docker_host}-{metric}.track"'},
        )

    @app.get("/data-sources", dependencies=_AUTH)
    async def data_sources(user_id: str | None = Depends(get_user_id)) -> dict[str, list[str]]:
        names = list(plugin_manager.data_sources.keys())
        privacy = {}
        for name in names:
            record = await get_privacy(redis_client, name)
            if record is not None:
                privacy[name] = record
        return {"data_sources": visible_data_sources(names, privacy, user_id)}

    @app.put("/data-sources/{name}/privacy", dependencies=_AUTH)
    async def data_source_privacy(
        name: str, body: dict, user_id: str | None = Depends(get_user_id)
    ) -> dict:
        if name not in plugin_manager.data_sources:
            raise HTTPException(status_code=404, detail=f"unknown data source: {name!r}")
        if not user_id:
            raise HTTPException(status_code=400, detail="X-Correlator-User-Id is required")
        try:
            record = await set_privacy(redis_client, name, user_id, bool(body.get("is_private")))
        except OwnershipConflictError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        return {"owner_user_id": record.owner_user_id, "is_private": record.is_private}

    @app.post("/mesh/ownership/claim", dependencies=_AUTH)
    async def mesh_ownership_claim(body: dict) -> dict:
        return {"claimed": await mesh.write_ownership(redis_client, body)}

    @app.post("/mesh/ownership/nonce", dependencies=_AUTH)
    async def mesh_ownership_nonce() -> dict:
        nonce = secrets.token_hex(16)
        await mesh.remember_nonce(redis_client, nonce, ttl_seconds=300)
        return {"nonce": nonce}

    @app.post("/mesh/ownership/rotate", dependencies=_AUTH)
    async def mesh_ownership_rotate(body: dict) -> dict:
        try:
            await mesh.require_owner_signature(redis_client, body, action="rotate")
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        new_owner = body.get("new_owner")
        if not new_owner:
            raise HTTPException(status_code=422, detail="'new_owner' is required")
        await mesh.overwrite_ownership(redis_client, new_owner)
        return {"rotated": True}

    @app.get("/mesh/peers", dependencies=_AUTH)
    async def mesh_peers() -> dict:
        return {"peers": await mesh.load_peer_list(redis_client)}

    @app.post("/mesh/peers/sync", dependencies=_AUTH)
    async def mesh_peers_sync(body: dict) -> dict:
        current = await mesh.load_peer_list(redis_client)
        for key, incoming in body.get("peers", {}).items():
            current[key] = mesh.merge_peer_entry(current.get(key), incoming)
        await mesh.save_peer_list(redis_client, current)
        return {"peers": current}

    @app.post("/promote", dependencies=_AUTH)
    async def promote(body: dict) -> dict:
        name = body.get("name")
        if not name:
            raise HTTPException(status_code=422, detail="'name' is required")
        source = plugin_manager.data_sources.get(name)
        if source is None:
            raise HTTPException(status_code=404, detail=f"unknown data source: {name!r}")
        if source.transport is None:
            raise HTTPException(
                status_code=422,
                detail=f"data source {name!r} has no exec transport to promote over",
            )
        params = PromotionParams(
            name=name,
            image_ref=body["image_ref"],
            port=body.get("port", 8765),
            api_token=body.get("api_token"),
        )
        result = await promote_data_stream(source.transport, body["host"], params)
        return {
            "container_name": result.container_name,
            "host": result.host,
            "port": result.port,
            "reachable": result.reachable,
        }

    plugin_manager.hook.contribute_routes(app=app)
    validate_plugin_routes(app)

    return app


__all__ = ["create_app", "STREAM_KEY"]
