"""cor-CORE.PLUGIN-001 acceptance tests (REQ-000003 Requirement 3),
cor-CORE.DATASTREAM-001's transport/data-source registration mechanism
(REQ-000004 Requirement 1), and cor-CORE.DATASTREAM-003's
register_background_task hook (REQ-000009 Requirement 1)."""

import asyncio
from importlib.metadata import EntryPoint

from correlator_sump.datasource import ContainerRef
from correlator_sump.plugins import PluginManager, hookimpl
from correlator_sump.transport import ExecResult, Transport


class _FakePlugin:
    """A minimal test-double plugin implementing one hookspec, standing
    in for a real installed package declaring itself under the
    `sump.plugins` entry-point group."""

    @hookimpl
    def sump_plugin_info(self) -> dict:
        return {"name": "fake-plugin", "version": "0.0.1"}


# Pre-built instances, referenced by entry points below -- mirrors how a
# real installed package's entry point typically points at a module-level
# object, not a bare class that would still need instantiating. Separate
# instances per name so pluggy (which tracks plugins by identity) never
# sees the same object registered twice in one test.
_fake_plugin_instance = _FakePlugin()
_other_plugin_instance = _FakePlugin()


def _fake_entry_point(name: str = "fake") -> EntryPoint:
    attr = "_fake_plugin_instance" if name == "fake" else "_other_plugin_instance"
    return EntryPoint(name=name, value=f"{__name__}:{attr}", group="sump.plugins")


async def test_zero_plugins_starts_clean(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points", lambda group="sump.plugins": []
    )
    manager = PluginManager()
    loaded = await manager.discover()
    assert loaded == []
    assert manager.loaded_plugin_names == []


async def test_installed_plugin_is_discovered_and_loaded(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [_fake_entry_point()],
    )
    manager = PluginManager()
    loaded = await manager.discover()

    assert loaded == ["fake"]
    results = manager.hook.sump_plugin_info()
    assert {"name": "fake-plugin", "version": "0.0.1"} in results


async def test_explicitly_disabled_plugin_is_not_loaded(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [_fake_entry_point("fake"), _fake_entry_point("other")],
    )
    manager = PluginManager(disabled=["fake"])
    loaded = await manager.discover()

    assert loaded == ["other"]
    assert "fake" not in manager.loaded_plugin_names


class _NullTransport(Transport):
    def _shell_command(self, script: str) -> list[str]:
        return ["sh", "-c", script]

    async def run(self, args):  # noqa: ANN001, ANN201 -- test double
        return ExecResult(returncode=0, stdout="", stderr="")

    def stream_lines(self, args):  # noqa: ANN001, ANN201 -- test double
        raise NotImplementedError


class _FakeDataSource:
    name = "fake-source"
    transport = _NullTransport()

    async def list_targets(self) -> list[ContainerRef]:
        return [ContainerRef(container_id="c1", container_name="c1-name")]


class _TransportRegisteringPlugin:
    @hookimpl
    def register_transport(self, manager: PluginManager) -> None:
        manager.add_transport_type("null", _NullTransport)


class _DataSourceRegisteringPlugin:
    @hookimpl
    def register_data_source(self, manager: PluginManager) -> None:
        manager.add_data_source("fake-source", _FakeDataSource())


class _AsyncDataSourceRegisteringPlugin:
    """An `async def` hookimpl -- proves `discover()` awaits a registration
    hook's coroutine result rather than only handling sync hookimpls."""

    @hookimpl
    async def register_data_source(self, manager: PluginManager) -> None:
        manager.add_data_source("async-fake-source", _FakeDataSource())


_transport_plugin_instance = _TransportRegisteringPlugin()
_data_source_plugin_instance = _DataSourceRegisteringPlugin()
_async_data_source_plugin_instance = _AsyncDataSourceRegisteringPlugin()


async def test_register_transport_hook_populates_transport_types(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(
                name="transport-plugin",
                value=f"{__name__}:_transport_plugin_instance",
                group="sump.plugins",
            )
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert "null" in manager.transport_types
    assert manager.transport_types["null"] is _NullTransport


async def test_register_data_source_hook_populates_data_sources(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(
                name="data-source-plugin",
                value=f"{__name__}:_data_source_plugin_instance",
                group="sump.plugins",
            )
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert "fake-source" in manager.data_sources
    assert manager.data_sources["fake-source"].name == "fake-source"


async def test_async_register_data_source_hook_is_awaited(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(
                name="async-data-source-plugin",
                value=f"{__name__}:_async_data_source_plugin_instance",
                group="sump.plugins",
            )
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert "async-fake-source" in manager.data_sources


_call_order: list[str] = []


class _OrderTrackingTransportPlugin:
    @hookimpl
    def register_transport(self, manager: PluginManager) -> None:
        _call_order.append("register_transport")
        # Both plugins must already be loaded by the time either
        # registration hook fires -- not called per-plugin as each loads.
        assert set(manager.loaded_plugin_names) == {"a", "b"}


class _OrderTrackingDataSourcePlugin:
    @hookimpl
    def register_data_source(self, manager: PluginManager) -> None:
        _call_order.append("register_data_source")
        assert set(manager.loaded_plugin_names) == {"a", "b"}


_order_a = _OrderTrackingTransportPlugin()
_order_b = _OrderTrackingDataSourcePlugin()


async def test_registration_hooks_fire_once_after_all_plugins_loaded(monkeypatch) -> None:
    _call_order.clear()
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(name="a", value=f"{__name__}:_order_a", group="sump.plugins"),
            EntryPoint(name="b", value=f"{__name__}:_order_b", group="sump.plugins"),
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert _call_order == ["register_transport", "register_data_source"]


async def _fake_background_task() -> None:
    await asyncio.sleep(3600)


class _BackgroundTaskRegisteringPlugin:
    @hookimpl
    def register_background_task(self, manager: PluginManager) -> None:
        manager.add_background_task("fake-relay", _fake_background_task)


class _AsyncBackgroundTaskRegisteringPlugin:
    """An `async def` hookimpl -- proves `discover()` awaits this
    registration hook's coroutine result too, same as
    `register_data_source`."""

    @hookimpl
    async def register_background_task(self, manager: PluginManager) -> None:
        manager.add_background_task("async-fake-relay", _fake_background_task)


_background_task_plugin_instance = _BackgroundTaskRegisteringPlugin()
_async_background_task_plugin_instance = _AsyncBackgroundTaskRegisteringPlugin()


async def test_register_background_task_hook_populates_factories(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(
                name="background-task-plugin",
                value=f"{__name__}:_background_task_plugin_instance",
                group="sump.plugins",
            )
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert "fake-relay" in manager.background_task_factories
    assert manager.background_task_factories["fake-relay"] is _fake_background_task


async def test_async_register_background_task_hook_is_awaited(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(
                name="async-background-task-plugin",
                value=f"{__name__}:_async_background_task_plugin_instance",
                group="sump.plugins",
            )
        ],
    )
    manager = PluginManager()
    await manager.discover()

    assert "async-fake-relay" in manager.background_task_factories


def test_validate_plugin_routes_detects_conflict() -> None:
    import pytest
    from fastapi import FastAPI

    from correlator_sump.plugins import validate_plugin_routes

    app = FastAPI()

    @app.get("/test")
    def r1():
        return {}

    @app.get("/test")
    def r2():
        return {}

    with pytest.raises(ValueError, match="Plugin route conflict detected"):
        validate_plugin_routes(app)


async def test_isolated_background_task_catches_unhandled_exception() -> None:
    from correlator_sump.app import _run_isolated_background_task

    async def failing_factory():
        raise RuntimeError("Task crashed")

    # Proves unhandled exception is caught and logged without raising up
    await _run_isolated_background_task("failing-task", failing_factory)
