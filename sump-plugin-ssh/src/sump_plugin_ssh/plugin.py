"""The `sump.plugins` entry point (cor-CORE.DATASTREAM-002).

Registers the `ssh`/`local` transport factories and, at startup,
performs self-host detection: if the Sump's own host runs Docker, a
"self" `DockerHostDataSource` is registered, self-filtered by default.
"""

from __future__ import annotations

import logging
from typing import Any

from correlator_sump.datasource import DataSource
from correlator_sump.plugins import hookimpl
from correlator_sump.transport import Transport

from sump_plugin_ssh.datasource import DockerHostDataSource
from sump_plugin_ssh.transport import LocalTransport, SSHTransport

logger = logging.getLogger(__name__)

PLUGIN_NAME = "ssh"
PLUGIN_VERSION = "0.1.0"


async def detect_self_host_data_source(
    transport: Transport | None = None,
) -> DataSource | None:
    """Probe whether the Sump's own host runs Docker (`docker info`), and
    if so, return a "self" `DockerHostDataSource` for it (self-filtered
    by default -- see `containers.list_containers`). Returns `None`,
    never raises, if Docker isn't available locally (e.g. a CI
    environment, or a Sump not co-located with any Docker host) --
    matching this plugin's "sleep, don't crash" posture for an
    environment that simply doesn't support self-host detection."""
    transport = transport or LocalTransport()
    try:
        result = await transport.run(["docker", "info"])
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return DockerHostDataSource("self", transport, include_self=False)


class SumpPluginSSH:
    @hookimpl
    def sump_plugin_info(self) -> dict[str, Any]:
        return {"name": PLUGIN_NAME, "version": PLUGIN_VERSION}

    @hookimpl
    def register_transport(self, manager: Any) -> None:
        manager.add_transport_type("local", LocalTransport)
        manager.add_transport_type("ssh", SSHTransport)

    @hookimpl
    async def register_data_source(self, manager: Any) -> None:
        source = await detect_self_host_data_source()
        if source is not None:
            manager.add_data_source(source.name, source)
        else:
            logger.info("self-host detection found no local Docker; no self data source registered")


#: The module-level instance the `sump.plugins` entry point (pyproject.toml)
#: points at -- mirrors how a real installed package's entry point
#: typically points at a pre-built object, not a bare class.
plugin = SumpPluginSSH()
