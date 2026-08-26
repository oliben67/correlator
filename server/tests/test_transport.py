"""cor-CORE.DATASTREAM-001 acceptance tests: the `Transport` ABC contract."""

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager

from correlator_sump.transport import ExecResult, Transport, TransportError


class _EchoTransport(Transport):
    """Minimal concrete transport: records what it was asked to run,
    proving the ABC's contract (and `run_shell`'s delegation to
    `_shell_command` + `run`) without needing a real subprocess/SSH."""

    def __init__(self) -> None:
        self.calls: list[Sequence[str]] = []

    def _shell_command(self, script: str) -> list[str]:
        return ["sh", "-c", script]

    async def run(self, args: Sequence[str]) -> ExecResult:
        self.calls.append(args)
        return ExecResult(returncode=0, stdout=" ".join(args), stderr="")

    @asynccontextmanager
    async def stream_lines(self, args: Sequence[str]) -> AsyncIterator[AsyncIterator[str]]:
        async def _lines() -> AsyncIterator[str]:
            yield "line"

        yield _lines()


async def test_run_records_the_exact_argv() -> None:
    transport = _EchoTransport()

    result = await transport.run(["docker", "ps"])

    assert transport.calls == [["docker", "ps"]]
    assert result.returncode == 0


async def test_run_shell_delegates_through_shell_command() -> None:
    transport = _EchoTransport()

    await transport.run_shell("echo a; echo b")

    assert transport.calls == [["sh", "-c", "echo a; echo b"]]


def test_exec_result_check_raises_on_nonzero_returncode() -> None:
    result = ExecResult(returncode=1, stdout="", stderr="boom")

    try:
        result.check()
    except TransportError as exc:
        assert "boom" in str(exc)
    else:
        raise AssertionError("expected TransportError")


def test_exec_result_check_returns_self_on_success() -> None:
    result = ExecResult(returncode=0, stdout="ok", stderr="")

    assert result.check() is result
