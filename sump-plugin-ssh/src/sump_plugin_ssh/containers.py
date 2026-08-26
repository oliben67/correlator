"""Container listing + self-filter (cor-CORE.DATASTREAM-002).

Direct port of `log-sump`'s `containers_listing._list_containers`/
`_is_log_sump_container` -- the self-filter-by-default design this
implements is grounded in `log-sump`'s own `BUG-0104` (its container
appearing in its own docker-host listing).
"""

from __future__ import annotations

import json

from correlator_sump.datasource import ContainerRef
from correlator_sump.transport import TransportLike

#: Matched by the compose-assigned service label, not image ref or
#: container name: both vary across deployments (a locally built image
#: vs. one pulled from a registry, a project-prefixed container name),
#: `com.docker.compose.service` does not.
SUMP_COMPOSE_SERVICE_LABEL = "com.docker.compose.service=correlator-sump"


def _is_own_sump_container(data: dict[str, str]) -> bool:
    """The Sump's own deployed container watches the very host it runs on
    (bind-mounted `/var/run/docker.sock`), so it always shows up in its
    own `docker ps` output alongside every real container -- it must
    never be offered as something to watch, unless explicitly opted into
    (self-watch)."""
    labels = data.get("Labels", "")
    return SUMP_COMPOSE_SERVICE_LABEL in labels.split(",")


async def list_containers(
    transport: TransportLike, *, include_self: bool = False
) -> list[ContainerRef]:
    """List currently running containers reachable via `transport`,
    filtering out the Sump's own container unless `include_self` is set
    (opt-in self-watch, cor-CORE.DATASTREAM-002)."""
    result = await transport.run(["docker", "ps", "--format", "{{json .}}"])
    result.check()

    refs: list[ContainerRef] = []
    seen: set[str] = set()
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        if not include_self and _is_own_sump_container(data):
            continue
        ref = ContainerRef(container_id=data["ID"], container_name=data["Names"])
        if ref.container_id in seen:
            continue
        seen.add(ref.container_id)
        refs.append(ref)
    return refs
