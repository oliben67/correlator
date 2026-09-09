"""cor-CORE.FEDERATION-004: promotion flow."""

from __future__ import annotations

from collections.abc import Sequence

import httpx
import pytest

from correlator_sump.promotion import PromotionParams, promote_data_stream
from correlator_sump.transport import ExecResult, TransportError


class _FakeTransport:
    def __init__(self) -> None:
        self.calls: list[Sequence[str]] = []

    async def run(self, args: Sequence[str]) -> ExecResult:
        self.calls.append(list(args))
        return ExecResult(returncode=0, stdout="", stderr="")


async def test_promote_runs_expected_docker_run_argv() -> None:
    transport = _FakeTransport()
    params = PromotionParams(
        name="prod-host",
        image_ref="ghcr.io/oliben67/correlator-sump:0.2.0",
        port=8770,
        api_token="tok-123",
    )
    http_client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200))
    )

    result = await promote_data_stream(transport, "10.0.0.5", params, http_client=http_client)
    await http_client.aclose()

    assert transport.calls == [
        [
            "docker",
            "run",
            "-d",
            "--name",
            "correlator-sump-prod-host",
            "-p",
            "8770:8765",
            "-e",
            "CORRELATOR_API_TOKEN=tok-123",
            "ghcr.io/oliben67/correlator-sump:0.2.0",
        ]
    ]
    assert result.container_name == "correlator-sump-prod-host"
    assert result.host == "10.0.0.5"
    assert result.port == 8770
    assert result.reachable is True


async def test_promote_omits_token_flag_when_none_given() -> None:
    transport = _FakeTransport()
    params = PromotionParams(name="x", image_ref="img", port=8765)
    http_client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200))
    )

    await promote_data_stream(transport, "h", params, http_client=http_client)
    await http_client.aclose()

    assert "-e" not in transport.calls[0]


async def test_promote_health_check_timeout_is_reported_not_raised() -> None:
    transport = _FakeTransport()
    params = PromotionParams(name="x", image_ref="img", port=8765)

    def _raise_timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("no route to host")

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(_raise_timeout))

    result = await promote_data_stream(
        transport, "unreachable-host", params, http_client=http_client
    )
    await http_client.aclose()

    assert result.reachable is False


async def test_promote_raises_when_docker_run_fails() -> None:
    class _FailingTransport:
        async def run(self, args: Sequence[str]) -> ExecResult:
            return ExecResult(returncode=1, stdout="", stderr="no such image")

    params = PromotionParams(name="x", image_ref="does-not-exist", port=8765)

    with pytest.raises(TransportError):
        await promote_data_stream(_FailingTransport(), "h", params)
