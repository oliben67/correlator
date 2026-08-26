"""pytest/pluggy-style plugin manager for the Sump server.

Implements cor-CORE.PLUGIN-001: entry-point discovery (never a directory
scan), default-on/explicit-opt-out loading, and a fixed hookspec set a
plugin implements any subset of. See REQ-000003 Requirement 3.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Iterable
from importlib.metadata import EntryPoint, entry_points
from typing import Any

import pluggy

PROJECT_NAME = "sump"
ENTRY_POINT_GROUP = "sump.plugins"

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
        """Register a `TransportPlugin` implementing the `Transport` ABC."""

    @hookspec
    def register_data_source(self, manager: PluginManager) -> None:
        """Register a data-stream source (§6.3)."""

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

    def discover(self) -> list[str]:
        """Discover every package under the `sump.plugins` entry-point
        group and load it unless its name is explicitly disabled. Returns
        the names actually loaded. Safe to call with zero plugins
        installed -- `entry_points(group=...)` returns an empty iterable
        rather than raising, so there is no "missing directory" failure
        mode."""
        for ep in _discover_entry_points():
            if ep.name in self._disabled:
                continue
            plugin = ep.load()
            self._pm.register(plugin, name=ep.name)
            self.loaded_plugin_names.append(ep.name)
        return self.loaded_plugin_names

    @property
    def hook(self) -> Any:
        return self._pm.hook

    def register(self, plugin: Any, name: str | None = None) -> None:
        """Register a plugin object directly (used by tests and by code
        that already holds a plugin instance rather than an entry point)."""
        self._pm.register(plugin, name=name)
        if name is not None:
            self.loaded_plugin_names.append(name)
