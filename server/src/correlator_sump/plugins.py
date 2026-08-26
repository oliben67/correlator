"""pytest/pluggy-style plugin manager for the Sump server.

Implements cor-CORE.PLUGIN-001: entry-point discovery (never a directory
scan), default-on/explicit-opt-out loading, and a fixed hookspec set a
plugin implements any subset of. See REQ-000003 Requirement 3.
"""

from __future__ import annotations

import inspect
from abc import abstractmethod
from collections.abc import Callable, Iterable
from importlib.metadata import EntryPoint, entry_points
from typing import Any

import pluggy

from correlator_sump.datasource import DataSource
from correlator_sump.transport import Transport

PROJECT_NAME = "sump"
ENTRY_POINT_GROUP = "sump.plugins"

#: Constructs a `Transport` for a specific target (e.g. `SSHTransport(host,
#: user, port=22)`, `LocalTransport()`) -- parameters differ per transport
#: type, so this is intentionally loose; `register_transport` registers the
#: factory itself, not a pre-built instance, since the target isn't known
#: until something (e.g. a future provisioning flow) actually needs one.
TransportFactory = Callable[..., Transport]

hookspec = pluggy.HookspecMarker(PROJECT_NAME)
hookimpl = pluggy.HookimplMarker(PROJECT_NAME)


class SumpHookSpecs:
    """The fixed set of hooks a Sump plugin may implement any subset of."""

    @hookspec
    @abstractmethod
    def sump_plugin_info(self) -> dict[str, Any]:
        """Return this plugin's name/version/capability manifest."""

    @hookspec
    def register_transport(self, manager: PluginManager) -> None:
        """Register a `TransportPlugin` implementing the `Transport` ABC.
        May be `async def` (awaited by `PluginManager.discover`)."""

    @hookspec
    def register_data_source(self, manager: PluginManager) -> None:
        """Register a data-stream source (§6.3). May be `async def`
        (awaited by `PluginManager.discover`) -- e.g. self-host detection
        needs a real transport call."""

    @hookspec
    def contribute_routes(self, app: Any) -> None:
        """Optionally add custom API routes to the Sump's FastAPI app."""

    @hookspec
    def on_health_check(self) -> bool | None:
        """Report this plugin's health. `None` means "not applicable"."""


def _discover_entry_points(group: str = ENTRY_POINT_GROUP) -> Iterable[EntryPoint]:
    return entry_points(group=group)


class PluginManager:
    """Wraps `pluggy.PluginManager` with Sump's entry-point discovery and
    default-on/explicit-opt-out loading (cor-CORE.PLUGIN-001)."""

    def __init__(self, disabled: Iterable[str] = ()) -> None:
        self._disabled = frozenset(disabled)
        self._pm = pluggy.PluginManager(PROJECT_NAME)
        self._pm.add_hookspecs(SumpHookSpecs)
        self.loaded_plugin_names: list[str] = []
        self.transport_types: dict[str, TransportFactory] = {}
        self.data_sources: dict[str, DataSource] = {}

    async def discover(self) -> list[str]:
        """Discover every package under the `sump.plugins` entry-point
        group and load it unless its name is explicitly disabled (safe
        with zero plugins installed -- `entry_points(group=...)` returns
        an empty iterable rather than raising, so there is no "missing
        directory" failure mode), then fire `register_transport`/
        `register_data_source` exactly once, after every plugin has
        loaded (cor-CORE.DATASTREAM-001) -- never per-plugin during
        loading, so a later-loaded plugin can't be missed by an
        earlier-loaded one's registration pass. Returns the names
        actually loaded.

        `register_transport`/`register_data_source` hookimpls may be
        `async def` (e.g. self-host detection needs a real transport
        call) even though pluggy's own hook caller is synchronous: pluggy
        just calls each hookimpl and collects whatever it returns, so an
        `async def` hookimpl's "return value" is simply its unawaited
        coroutine object -- awaited here instead, one at a time, rather
        than each hookimpl needing to bridge sync/async itself (which
        would risk an `asyncio.run()` call nested inside this method's
        own already-running event loop)."""
        for ep in _discover_entry_points():
            if ep.name in self._disabled:
                continue
            plugin = ep.load()
            self._pm.register(plugin, name=ep.name)
            self.loaded_plugin_names.append(ep.name)
        for result in self._pm.hook.register_transport(manager=self):
            if inspect.isawaitable(result):
                await result
        for result in self._pm.hook.register_data_source(manager=self):
            if inspect.isawaitable(result):
                await result
        return self.loaded_plugin_names

    def add_transport_type(self, name: str, factory: TransportFactory) -> None:
        """Called by a plugin's `register_transport` hookimpl to register a
        `Transport` factory under `name` (e.g. `"ssh"`, `"local"`)."""
        self.transport_types[name] = factory

    def add_data_source(self, name: str, source: DataSource) -> None:
        """Called by a plugin's `register_data_source` hookimpl to register
        a concrete `DataSource` under `name` (e.g. `"self"`)."""
        self.data_sources[name] = source

    @property
    def hook(self) -> Any:
        return self._pm.hook

    def register(self, plugin: Any, name: str | None = None) -> None:
        """Register a plugin object directly (used by tests and by code
        that already holds a plugin instance rather than an entry point)."""
        self._pm.register(plugin, name=name)
        if name is not None:
            self.loaded_plugin_names.append(name)
