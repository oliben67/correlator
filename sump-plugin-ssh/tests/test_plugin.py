"""cor-CORE.DATASTREAM-002 acceptance tests: the plugin's hookimpls."""

from correlator_sump.plugins import PluginManager
from correlator_sump.transport import ExecResult, Transport

from sump_plugin_ssh.plugin import SumpPluginSSH, detect_self_host_data_source
from sump_plugin_ssh.transport import LocalTransport, SSHTransport


class _FakeTransport(Transport):
    def __init__(self, returncode: int) -> None:
        self._returncode = returncode

    def _shell_command(self, script: str) -> list[str]:
        raise NotImplementedError

    async def run(self, args):  # noqa: ANN001, ANN201 -- test double
        return ExecResult(returncode=self._returncode, stdout="", stderr="")

    def stream_lines(self, args):  # noqa: ANN001, ANN201 -- test double
        raise NotImplementedError


class _RaisingTransport(Transport):
    def _shell_command(self, script: str) -> list[str]:
        raise NotImplementedError

    async def run(self, args):  # noqa: ANN001, ANN201 -- test double
        raise OSError("docker: command not found")

    def stream_lines(self, args):  # noqa: ANN001, ANN201 -- test double
        raise NotImplementedError


async def test_self_host_detection_registers_source_when_docker_available() -> None:
    source = await detect_self_host_data_source(_FakeTransport(returncode=0))

    assert source is not None
    assert source.name == "self"


async def test_self_host_detection_returns_none_when_docker_unavailable() -> None:
    source = await detect_self_host_data_source(_FakeTransport(returncode=1))

    assert source is None


async def test_self_host_detection_returns_none_without_raising_when_docker_binary_missing() -> (
    None
):
    source = await detect_self_host_data_source(_RaisingTransport())

    assert source is None


async def test_sump_plugin_info_reports_name_and_version() -> None:
    plugin = SumpPluginSSH()

    info = plugin.sump_plugin_info()

    assert info["name"] == "ssh"
    assert "version" in info


def test_register_transport_registers_local_and_ssh_factories() -> None:
    plugin = SumpPluginSSH()
    manager = PluginManager()

    plugin.register_transport(manager)

    assert manager.transport_types["local"] is LocalTransport
    assert manager.transport_types["ssh"] is SSHTransport


async def test_register_data_source_via_manager_discover(monkeypatch) -> None:
    """End-to-end through PluginManager.discover(), not just calling the
    hookimpl directly -- proves the async hookimpl is actually awaited by
    the manager (cor-CORE.DATASTREAM-001's async-hookimpl contract)."""
    from importlib.metadata import EntryPoint

    monkeypatch.setattr(
        "sump_plugin_ssh.plugin.LocalTransport", lambda: _FakeTransport(returncode=0)
    )
    monkeypatch.setattr(
        "correlator_sump.plugins._discover_entry_points",
        lambda group="sump.plugins": [
            EntryPoint(name="ssh", value="sump_plugin_ssh.plugin:plugin", group="sump.plugins")
        ],
    )
    manager = PluginManager()

    await manager.discover()

    assert "self" in manager.data_sources
    assert "local" in manager.transport_types
    assert "ssh" in manager.transport_types
