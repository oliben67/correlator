"""cor-CORE.DATASTREAM-002 acceptance tests: the self-filter (BUG-0104 fix)."""

import json

from correlator_sump.transport import ExecResult

from sump_plugin_ssh.containers import SUMP_COMPOSE_SERVICE_LABEL, list_containers


class _FakeTransport:
    def __init__(self, docker_ps_lines: list[dict]) -> None:
        self._lines = docker_ps_lines

    async def run(self, args):  # noqa: ANN001, ANN201 -- test double
        stdout = "\n".join(json.dumps(line) for line in self._lines)
        return ExecResult(returncode=0, stdout=stdout, stderr="")


def _container(id_: str, name: str, *, is_sump: bool = False) -> dict:
    labels = SUMP_COMPOSE_SERVICE_LABEL if is_sump else "some.other.label=x"
    return {"ID": id_, "Names": name, "Labels": labels}


async def test_lists_regular_containers() -> None:
    transport = _FakeTransport([_container("c1", "app-1"), _container("c2", "app-2")])

    refs = await list_containers(transport)

    assert {r.container_id for r in refs} == {"c1", "c2"}


async def test_filters_own_sump_container_by_default() -> None:
    transport = _FakeTransport(
        [_container("c1", "app-1"), _container("sump-id", "correlator-sump-1", is_sump=True)]
    )

    refs = await list_containers(transport)

    assert {r.container_id for r in refs} == {"c1"}


async def test_include_self_opts_into_self_watch() -> None:
    transport = _FakeTransport(
        [_container("c1", "app-1"), _container("sump-id", "correlator-sump-1", is_sump=True)]
    )

    refs = await list_containers(transport, include_self=True)

    assert {r.container_id for r in refs} == {"c1", "sump-id"}


async def test_empty_docker_ps_output_is_empty_list() -> None:
    transport = _FakeTransport([])

    refs = await list_containers(transport)

    assert refs == []


async def test_matches_by_label_not_name_or_image() -> None:
    """The whole point of BUG-0104's fix: the Sump's own container could
    be named/tagged anything -- only the compose service label is
    trustworthy across deployments."""
    transport = _FakeTransport([_container("weird-id", "totally-unrelated-name-xyz", is_sump=True)])

    refs = await list_containers(transport)

    assert refs == []
