"""`DockerHostDataSource` (cor-CORE.DATASTREAM-002).

The concrete `DataSource` this plugin registers: a Docker host reachable
via some `Transport` (local or SSH), listable via `containers.list_containers`.
"""

from __future__ import annotations

from correlator_sump.datasource import ContainerRef
from correlator_sump.transport import Transport

from sump_plugin_ssh.containers import list_containers


class DockerHostDataSource:
    """Implements `correlator_sump.datasource.DataSource`."""

    def __init__(self, name: str, transport: Transport, *, include_self: bool = False) -> None:
        self._name = name
        self._transport = transport
        self._include_self = include_self

    @property
    def name(self) -> str:
        return self._name

    @property
    def transport(self) -> Transport:
        return self._transport

    async def list_targets(self) -> list[ContainerRef]:
        return await list_containers(self._transport, include_self=self._include_self)
