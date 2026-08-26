"""Daemon transport interface (cor-CORE.DATASTREAM-001).

Every command that reaches a Docker daemon's host (`docker ps`, `docker
logs -f`, ...) goes through a `Transport`. Ported unchanged in shape from
`log-sump`'s own `Transport` ABC: callers only ever depend on this
interface, so a concrete transport (local subprocess, SSH, a future
aiodocker-over-TLS transport) can swap in without touching call sites.
Concrete transports live in whichever plugin registers them via
`register_transport` (cor-CORE.DATASTREAM-001) -- none live here.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator, AsyncIterator, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import Literal, Protocol


class TransportError(RuntimeError):
    """Raised when a transport-level command fails or the host is unreachable."""


@dataclass(frozen=True)
class ExecResult:
    returncode: int
    stdout: str
    stderr: str

    def check(self) -> ExecResult:
        if self.returncode != 0:
            raise TransportError(f"command exited {self.returncode}: {self.stderr.strip()}")
        return self


@dataclass(frozen=True)
class StreamLine:
    stream: Literal["stdout", "stderr"]
    text: str


class TransportLike(Protocol):
    """Structural narrowing of `Transport` for code that only ever calls
    `run` (e.g. `sump_plugin_ssh.containers.list_containers`,
    self-host detection) -- lets a test double satisfy the type without
    inheriting the full ABC."""

    async def run(self, args: Sequence[str]) -> ExecResult: ...


class Transport(ABC):
    """Runs Docker CLI / shell commands against one daemon's host."""

    @abstractmethod
    def _shell_command(self, script: str) -> list[str]:
        """Wrap a compound shell script (`;`, pipes, ...) into an argv list.

        A plain argv list has no shell to interpret `;`/pipes, and how to
        invoke one differs by transport in a way that's easy to get subtly
        wrong: a remote shell (SSH) already receives one joined command
        string, so `sh -c "cat a; cat b"` (passed as three separate argv
        elements) would get rejoined remotely -- silently splitting the
        script at the `;` instead of running it as one `sh -c` invocation.
        Passing the whole script as a single argument sidesteps that.
        Local execution has no implicit shell at all, so it needs an
        explicit `sh -c` wrapper instead. See `run_shell`.
        """

    @abstractmethod
    async def run(self, args: Sequence[str]) -> ExecResult:
        """Run a one-shot command (e.g. `docker ps`) and return its full output.

        Takes no `timeout` param by design -- wrap the call in
        `async with asyncio.timeout(seconds):` instead, so cancellation
        always follows the same path and the underlying command is
        guaranteed to be killed rather than leaked.
        """

    @abstractmethod
    def stream_lines(
        self, args: Sequence[str]
    ) -> AbstractAsyncContextManager[AsyncIterator[StreamLine]]:
        """Run a long-lived command and yield its stdout/stderr, line by line.

        Usage::

            async with transport.stream_lines(args) as lines:
                async for line in lines:
                    ...

        Guarantees the underlying command is terminated on cancellation or
        normal exit from the `async with` block.
        """

    async def run_shell(self, script: str) -> ExecResult:
        """Run a compound shell command (supports `;`, pipes, redirection, ...)."""
        return await self.run(self._shell_command(script))


async def merge_streams(
    stdout: asyncio.StreamReader, stderr: asyncio.StreamReader
) -> AsyncGenerator[StreamLine, None]:
    """Interleave two `StreamReader`s as they produce lines, in arrival order.

    Shared by any subprocess-based `Transport` implementation (e.g.
    `LocalTransport`, in the `sump-plugin-ssh` package) that needs to
    merge stdout/stderr for `stream_lines`.
    """
    queue: asyncio.Queue[StreamLine | None] = asyncio.Queue()

    async def pump(stream: asyncio.StreamReader, name: Literal["stdout", "stderr"]) -> None:
        async for raw_line in stream:
            await queue.put(
                StreamLine(stream=name, text=raw_line.decode(errors="replace").rstrip("\n"))
            )
        await queue.put(None)

    pumps = [
        asyncio.create_task(pump(stdout, "stdout")),
        asyncio.create_task(pump(stderr, "stderr")),
    ]
    remaining = len(pumps)
    try:
        while remaining > 0:
            item = await queue.get()
            if item is None:
                remaining -= 1
                continue
            yield item
    finally:
        for task in pumps:
            task.cancel()
        await asyncio.gather(*pumps, return_exceptions=True)
