"""End-to-end proof (REQ-000004 Summary): the plugin manager built in
Phase 1 actually discovers a real, separately-packaged, separately
pip/uv-installed plugin -- no monkeypatched entry points here, unlike
test_plugins.py's unit tests. `sump-plugin-ssh` is installed into this
package's own dev environment specifically so this test can exercise the
real `importlib.metadata.entry_points(group="sump.plugins")` discovery
path end to end."""

from correlator_sump.plugins import PluginManager


async def test_real_ssh_plugin_is_discovered_and_registers_transports() -> None:
    manager = PluginManager()

    loaded = await manager.discover()

    assert "ssh" in loaded
    assert "local" in manager.transport_types
    assert "ssh" in manager.transport_types

    # Self-host detection runs for real here (no Docker mocking) -- it
    # must never raise or crash discovery regardless of whether this
    # environment actually has Docker available (cor-CORE.DATASTREAM-002's
    # "sleep, don't crash" posture). Whether "self" ends up registered
    # depends entirely on whether `docker info` succeeds here.
    if "self" in manager.data_sources:
        assert manager.data_sources["self"].name == "self"
