"""End-to-end proof (REQ-000009 Requirement 3): the plugin manager
actually discovers the real, separately-packaged `sump-plugin-logstream`
-- no monkeypatched entry points here, unlike test_plugins.py's unit
tests. `sump-plugin-logstream` is installed into this package's own dev
environment specifically so this test can exercise the real
`importlib.metadata.entry_points(group="sump.plugins")` discovery path
end to end, mirroring test_integration_ssh_plugin.py's own precedent."""

from correlator_sump.plugins import PluginManager


class _FakeIngestAdapter:
    async def ingest(self, raw: bytes) -> bool:
        return True


async def test_real_logstream_plugin_is_discovered_without_env_configured(monkeypatch) -> None:
    for var in ("LOGSTREAM_BASE_URL", "LOGSTREAM_API_KEY", "LOGSTREAM_DOCKER_HOST"):
        monkeypatch.delenv(var, raising=False)

    manager = PluginManager()
    loaded = await manager.discover()

    assert "logstream" in loaded
    # Unconfigured in this environment (no LOGSTREAM_* env vars) --
    # "sleep, don't crash": discovery must complete cleanly with nothing
    # registered, matching sump-plugin-ssh's own unconfigured-environment
    # posture.
    assert manager.background_task_factories == {}
    assert "h1" not in manager.data_sources


async def test_real_logstream_plugin_registers_background_task_when_configured(
    monkeypatch,
) -> None:
    monkeypatch.setenv("LOGSTREAM_BASE_URL", "http://logsump.example")
    monkeypatch.setenv("LOGSTREAM_API_KEY", "secret")
    monkeypatch.setenv("LOGSTREAM_DOCKER_HOST", "h1")

    manager = PluginManager()
    manager.ingest_adapter = _FakeIngestAdapter()
    loaded = await manager.discover()

    assert "logstream" in loaded
    assert "logstream-h1" in manager.background_task_factories
    assert "h1" in manager.data_sources
