"""`LocalTransport`/`SSHTransport` (cor-CORE.DATASTREAM-002).

Direct port of `log-sump`'s `log_sump.common.transport` concrete
transports onto `correlator_sump.transport`'s `Transport` ABC -- same
shape and semantics, no behavior changes.
"""

from __future__ import annotations

import asyncio
import contextlib
import select
import shlex
import threading
from collections.abc import AsyncGenerator, AsyncIterator, Sequence
from typing import Literal

import paramiko
from correlator_sump.transport import ExecResult, StreamLine, Transport, merge_streams


class LocalTransport(Transport):
    """Runs commands directly on the local machine -- no `ssh` wrapper.

    Used for the Sump's own "self" data source (self-host detection,
    cor-CORE.DATASTREAM-002) so the exact same listing/streaming code
    paths run against a Docker socket already on this machine, with no
    SSH setup required.
    """

    def _shell_command(self, script: str) -> list[str]:
        # No ssh (and so no implicit remote shell) in the picture locally --
        # this process has to invoke one itself.
        return ["sh", "-c", script]

    async def run(self, args: Sequence[str]) -> ExecResult:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await proc.communicate()
        except asyncio.CancelledError:
            proc.kill()
            await proc.wait()
            raise
        return ExecResult(
            returncode=proc.returncode or 0,
            stdout=stdout.decode(errors="replace"),
            stderr=stderr.decode(errors="replace"),
        )

    @contextlib.asynccontextmanager
    async def stream_lines(self, args: Sequence[str]) -> AsyncIterator[AsyncIterator[StreamLine]]:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        assert proc.stdout is not None
        assert proc.stderr is not None
        lines: AsyncGenerator[StreamLine, None] = merge_streams(proc.stdout, proc.stderr)
        try:
            yield lines
        finally:
            await lines.aclose()
            if proc.returncode is None:
                proc.kill()
                await proc.wait()


#: How often the stream_lines() background thread re-checks for
#: cancellation between reads -- bounds how long a cancelled `async with`
#: block can take to actually notice the worker thread has stopped.
_SSH_POLL_INTERVAL_S = 0.5
#: `run()`/`stream_lines()` never raise on a connection/command failure --
#: they report it the same way a failed `ssh` *process* would (a non-zero
#: exit code / a stderr line), matching subprocess-based Transport's
#: existing contract so callers don't need transport-specific except
#: clauses. 255 mirrors OpenSSH's own "couldn't establish connection" exit
#: code.
_SSH_FAILURE_RETURNCODE = 255


class SSHTransport(Transport):
    """Reaches a daemon over SSH via `paramiko` -- a pure-Python client,
    not the system `ssh` binary."""

    def __init__(self, host: str, user: str, *, port: int = 22) -> None:
        self._host = host
        self._user = user
        self._port = port

    def _shell_command(self, script: str) -> list[str]:
        # A single command string -- paramiko's exec_command already runs
        # it through the remote login shell, so no local wrapping is
        # needed (mirrors the old ssh-CLI behavior).
        return [script]

    @staticmethod
    def _with_sudo(args: Sequence[str]) -> Sequence[str]:
        """Prepend `sudo` to remote `docker` invocations.

        The account this SSHes in as often isn't in the remote host's
        `docker` group -- unlike `LocalTransport`, which never needs
        this.
        """
        if args and args[0] == "docker":
            return ["sudo", *args]
        return args

    def _connect(self) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        # Trust-on-first-use -- the equivalent policy for this hop as the
        # client's own connection to the Sump.
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            self._host,
            port=self._port,
            username=self._user,
            # SSH_AUTH_SOCK agent forwarding and paramiko's own default
            # identity-file lookup -- no explicit password/key param.
            allow_agent=True,
            look_for_keys=True,
            timeout=10,
        )
        return client

    async def run(self, args: Sequence[str]) -> ExecResult:
        command = shlex.join(self._with_sudo(args))
        return await asyncio.to_thread(self._run_sync, command)

    def _run_sync(self, command: str) -> ExecResult:
        # Reported via ExecResult, never raised -- see _SSH_FAILURE_RETURNCODE.
        try:
            client = self._connect()
        except Exception as exc:  # noqa: BLE001
            return ExecResult(
                returncode=_SSH_FAILURE_RETURNCODE, stdout="", stderr=f"ssh connect failed: {exc}"
            )
        try:
            _stdin, stdout, stderr = client.exec_command(command)
            out = stdout.read().decode(errors="replace")
            err = stderr.read().decode(errors="replace")
            code = stdout.channel.recv_exit_status()
            return ExecResult(returncode=code, stdout=out, stderr=err)
        except Exception as exc:  # noqa: BLE001
            return ExecResult(
                returncode=_SSH_FAILURE_RETURNCODE, stdout="", stderr=f"ssh command failed: {exc}"
            )
        finally:
            client.close()

    @contextlib.asynccontextmanager
    async def stream_lines(self, args: Sequence[str]) -> AsyncIterator[AsyncIterator[StreamLine]]:
        command = shlex.join(self._with_sudo(args))
        loop = asyncio.get_event_loop()
        queue: asyncio.Queue[StreamLine | None] = asyncio.Queue()
        stop_event = threading.Event()
        state: dict[str, paramiko.SSHClient] = {}

        def emit(buf: bytes, chunk: bytes, stream: Literal["stdout", "stderr"]) -> bytes:
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                item = StreamLine(stream=stream, text=line.decode(errors="replace"))
                loop.call_soon_threadsafe(queue.put_nowait, item)
            return buf

        def worker() -> None:
            try:
                client = self._connect()
            except Exception as exc:  # noqa: BLE001 -- surfaced as a stderr line, like a failed ssh process would be
                error_line = StreamLine(stream="stderr", text=f"ssh connect failed: {exc}")
                loop.call_soon_threadsafe(queue.put_nowait, error_line)
                loop.call_soon_threadsafe(queue.put_nowait, None)
                return
            state["client"] = client
            try:
                if stop_event.is_set():
                    return
                _stdin, stdout, _stderr = client.exec_command(command)
                channel = stdout.channel
                channel.setblocking(0)
                stdout_buf = b""
                stderr_buf = b""
                while not stop_event.is_set():
                    readable, _, _ = select.select([channel], [], [], _SSH_POLL_INTERVAL_S)
                    read_any = False
                    if channel in readable:
                        if channel.recv_ready():
                            chunk = channel.recv(4096)
                            if chunk:
                                read_any = True
                                stdout_buf = emit(stdout_buf, chunk, "stdout")
                        if channel.recv_stderr_ready():
                            chunk = channel.recv_stderr(4096)
                            if chunk:
                                read_any = True
                                stderr_buf = emit(stderr_buf, chunk, "stderr")
                    if not read_any and channel.exit_status_ready():
                        break
            except (OSError, EOFError, paramiko.SSHException):
                # A closed channel (our own cancellation path below closing
                # `client`) or the remote end going away mid-read -- not a
                # real failure worth surfacing, just how a forced stop
                # looks from this thread's side.
                pass
            finally:
                client.close()
                loop.call_soon_threadsafe(queue.put_nowait, None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        async def _lines() -> AsyncGenerator[StreamLine, None]:
            while True:
                item = await queue.get()
                if item is None:
                    return
                yield item

        gen = _lines()
        try:
            yield gen
        finally:
            stop_event.set()
            client = state.get("client")
            if client is not None:
                # Closing here (not just setting stop_event) is what
                # actually unblocks a worker thread parked in select() /
                # recv() on a long-lived command like `docker logs -f`.
                client.close()
            await gen.aclose()
            await asyncio.to_thread(thread.join, 5)
