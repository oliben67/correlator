"""cor-CORE.DATASTREAM-002 acceptance tests: LocalTransport/SSHTransport."""

import asyncio
from unittest.mock import MagicMock, patch

import paramiko

from sump_plugin_ssh.transport import LocalTransport, SSHTransport


async def test_local_transport_run_captures_stdout() -> None:
    transport = LocalTransport()

    result = await transport.run(["echo", "hi"])

    assert result.returncode == 0
    assert result.stdout == "hi\n"


async def test_local_transport_run_shell_supports_compound_commands() -> None:
    transport = LocalTransport()

    result = await transport.run_shell("echo a; echo b")

    assert result.returncode == 0
    assert result.stdout == "a\nb\n"


async def test_local_transport_run_nonzero_exit() -> None:
    transport = LocalTransport()

    result = await transport.run(["sh", "-c", "exit 3"])

    assert result.returncode == 3


async def test_local_transport_stream_lines_yields_merged_output() -> None:
    transport = LocalTransport()

    lines = []
    async with transport.stream_lines(["sh", "-c", "echo out1; echo err1 >&2; echo out2"]) as it:
        async for line in it:
            lines.append(line.text)

    assert set(lines) == {"out1", "err1", "out2"}


def _mock_ssh_client(*, connect_error: Exception | None = None) -> MagicMock:
    client = MagicMock(spec=paramiko.SSHClient)
    if connect_error is not None:
        client.connect.side_effect = connect_error
    return client


async def test_ssh_transport_run_returns_255_on_connect_failure() -> None:
    transport = SSHTransport("unreachable-host", "user")

    with patch(
        "paramiko.SSHClient", return_value=_mock_ssh_client(connect_error=OSError("no route"))
    ):
        result = await transport.run(["docker", "ps"])

    assert result.returncode == 255
    assert "ssh connect failed" in result.stderr


async def test_ssh_transport_run_prepends_sudo_for_docker() -> None:
    client = _mock_ssh_client()
    stdout = MagicMock()
    stdout.read.return_value = b"ok\n"
    stdout.channel.recv_exit_status.return_value = 0
    stderr = MagicMock()
    stderr.read.return_value = b""
    client.exec_command.return_value = (MagicMock(), stdout, stderr)

    transport = SSHTransport("host", "user")
    with patch("paramiko.SSHClient", return_value=client):
        result = await transport.run(["docker", "ps"])

    assert result.returncode == 0
    client.exec_command.assert_called_once_with("sudo docker ps")


async def test_ssh_transport_run_does_not_prepend_sudo_for_non_docker() -> None:
    client = _mock_ssh_client()
    stdout = MagicMock()
    stdout.read.return_value = b""
    stdout.channel.recv_exit_status.return_value = 0
    stderr = MagicMock()
    stderr.read.return_value = b""
    client.exec_command.return_value = (MagicMock(), stdout, stderr)

    transport = SSHTransport("host", "user")
    with patch("paramiko.SSHClient", return_value=client):
        await transport.run(["cat", "/proc/uptime"])

    client.exec_command.assert_called_once_with("cat /proc/uptime")


async def test_ssh_transport_stream_lines_cancellation_closes_client() -> None:
    client = _mock_ssh_client()
    channel = MagicMock()
    channel.recv_ready.return_value = False
    channel.recv_stderr_ready.return_value = False
    channel.exit_status_ready.return_value = False
    stdout = MagicMock()
    stdout.channel = channel
    client.exec_command.return_value = (MagicMock(), stdout, MagicMock())

    transport = SSHTransport("host", "user")
    with (
        patch("paramiko.SSHClient", return_value=client),
        patch("select.select", return_value=([], [], [])),
    ):
        async with transport.stream_lines(["docker", "logs", "-f", "c1"]) as _lines:
            await asyncio.sleep(0.05)

    client.close.assert_called()
