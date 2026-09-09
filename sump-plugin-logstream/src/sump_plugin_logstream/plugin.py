"""The `sump.plugins` entry point (cor-CORE.DATASTREAM-003).

Reads `LOGSTREAM_BASE_URL`/`LOGSTREAM_API_KEY`/`LOGSTREAM_DOCKER_HOST`
from the environment -- no provisioning/catalog UI exists yet to
configure a logstream target (matching `sump-plugin-ssh`'s own
precedent for remote SSH hosts). If any is unset, registers nothing
(logs and returns) rather than failing Sump startup -- "sleep, don't
crash" for an unconfigured environment, same posture
`detect_self_host_data_source` already takes for a Docker-less one.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from correlator_sump.datasource import ContainerRef
from correlator_sump.plugins import hookimpl

from sump_plugin_logstream.client import LogSumpClient
from sump_plugin_logstream.relay import run_relay_loop

logger = logging.getLogger(__name__)

PLUGIN_NAME = "logstream"
PLUGIN_VERSION = "0.1.0"


class LogstreamDataSource:
    """Implements `correlator_sump.datasource.DataSource`. `transport` is
    always `None` (cor-CORE.DATASTREAM-003's widening of that protocol):
    this source is reached over `log-server`'s HTTP API, never by
    exec'ing a command against a host, so there is no `Transport` to
    offer -- `list_targets()` returns the one configured `docker_host`
    as its own target, standing in for "the daemon(s) this logstream
    source relays," since `log-server`'s own `/catalog` describes
    daemons the *target* log-sump watches, not sub-targets within this
    plugin's own listing contract."""

    def __init__(self, docker_host: str) -> None:
        self._docker_host = docker_host

    @property
    def name(self) -> str:
        return self._docker_host

    @property
    def transport(self) -> None:
        return None

    async def list_targets(self) -> list[ContainerRef]:
        return [ContainerRef(container_id=self._docker_host, container_name=self._docker_host)]


def _read_config() -> tuple[str, str, str] | None:
    base_url = os.environ.get("LOGSTREAM_BASE_URL")
    api_key = os.environ.get("LOGSTREAM_API_KEY")
    docker_host = os.environ.get("LOGSTREAM_DOCKER_HOST")
    if not base_url or not api_key or not docker_host:
        return None
    return base_url, api_key, docker_host


class SumpPluginLogstream:
    @hookimpl
    def sump_plugin_info(self) -> dict[str, Any]:
        return {"name": PLUGIN_NAME, "version": PLUGIN_VERSION}

    @hookimpl
    def register_data_source(self, manager: Any) -> None:
        config = _read_config()
        if config is None:
            logger.info(
                "logstream plugin unconfigured (LOGSTREAM_* env vars unset); "
                "no data source registered"
            )
            return
        _base_url, _api_key, docker_host = config
        manager.add_data_source(docker_host, LogstreamDataSource(docker_host))

    @hookimpl
    def register_background_task(self, manager: Any) -> None:
        config = _read_config()
        if config is None:
            logger.info(
                "logstream plugin unconfigured (LOGSTREAM_* env vars unset); "
                "no relay task registered"
            )
            return
        if manager.ingest_adapter is None:
            logger.warning("logstream plugin configured but manager.ingest_adapter is unset")
            return
        base_url, api_key, docker_host = config
        adapter = manager.ingest_adapter

        async def _relay() -> None:
            async with httpx.AsyncClient(
                base_url=base_url, headers={"X-API-Key": api_key}
            ) as http_client:
                client = LogSumpClient(http_client)
                await run_relay_loop(client, docker_host, adapter)

        manager.add_background_task(f"logstream-{docker_host}", _relay)


#: The module-level instance the `sump.plugins` entry point (pyproject.toml)
#: points at -- mirrors sump-plugin-ssh's own precedent.
plugin = SumpPluginLogstream()
