"""Promotion flow (cor-CORE.FEDERATION-004).

Turns a reachable data-stream host into its own first-class secondary
Sump: `docker run` a Sump container there over that data stream's own
`Transport`, SSH-initiated from this (parent) Sump, never from
correlator directly (§7.1). Scoped to a `registry`-type image only for
this first cut -- `Transport` (`run`/`run_shell`/`stream_lines`) is
exec-only with no `scp`-equivalent, so a tarball-transfer path (the way
`cor-CORE.PROVISION-002`'s `provisionRemote` supports one) isn't built
here; a genuine follow-up, not silently dropped.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from correlator_sump.transport import TransportLike


@dataclass(frozen=True)
class PromotionParams:
    name: str
    image_ref: str
    port: int
    api_token: str | None = None


@dataclass(frozen=True)
class PromotionResult:
    container_name: str
    host: str
    port: int
    reachable: bool


async def promote_data_stream(
    transport: TransportLike,
    host: str,
    params: PromotionParams,
    *,
    http_client: httpx.AsyncClient | None = None,
    health_timeout_s: float = 5.0,
) -> PromotionResult:
    """Runs `docker run -d` for a new Sump container on `host`, reached
    over `transport`, then best-effort health-checks it -- a timeout is
    reported as `reachable=False` in the result, not raised, mirroring
    `provisionRemote`'s own "not reachable directly yet" warning-not-
    error posture (ongoing traffic is plain HTTP, never tunneled
    through the SSH connection used only to install it)."""
    container_name = f"correlator-sump-{params.name}"
    argv = [
        "docker",
        "run",
        "-d",
        "--name",
        container_name,
        "-p",
        f"{params.port}:8765",
    ]
    if params.api_token:
        argv += ["-e", f"CORRELATOR_API_TOKEN={params.api_token}"]
    argv.append(params.image_ref)
    (await transport.run(argv)).check()

    reachable = False
    client = http_client or httpx.AsyncClient()
    try:
        response = await client.get(f"http://{host}:{params.port}/health", timeout=health_timeout_s)
        reachable = response.status_code == 200
    except httpx.HTTPError:
        reachable = False
    finally:
        if http_client is None:
            await client.aclose()

    return PromotionResult(
        container_name=container_name, host=host, port=params.port, reachable=reachable
    )
