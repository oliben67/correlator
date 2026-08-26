"""cor-CORE.PLUGIN-001 acceptance tests (REQ-000003 Requirement 3)."""

from importlib.metadata import EntryPoint

from correlator_sump.plugins import PluginManager, hookimpl


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


def test_zero_plugins_starts_clean(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points", lambda group="sump.plugins": []
    )
    manager = PluginManager()
    loaded = manager.discover()
    assert loaded == []
    assert manager.loaded_plugin_names == []


def test_installed_plugin_is_discovered_and_loaded(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [_fake_entry_point()],
    )
    manager = PluginManager()
    loaded = manager.discover()

    assert loaded == ["fake"]
    results = manager.hook.sump_plugin_info()
    assert {"name": "fake-plugin", "version": "0.0.1"} in results


def test_explicitly_disabled_plugin_is_not_loaded(monkeypatch) -> None:
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [_fake_entry_point("fake"), _fake_entry_point("other")],
    )
    manager = PluginManager(disabled=["fake"])
    loaded = manager.discover()

    assert loaded == ["other"]
    assert "fake" not in manager.loaded_plugin_names
